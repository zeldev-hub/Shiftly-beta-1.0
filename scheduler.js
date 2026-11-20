"use strict";

/* إنشاء المناوبات حسب أيام الأسبوع:
   الأحد إلى الخميس: 24 ساعة.
   الجمعة والسبت: مناوبة واحدة فقط لكل يوم، 12 ساعة حسب وقت البداية المحدد.
*/
function generateSchedule() {
  try {
    if (!Array.isArray(members) || members.length < 2) {
      showToast("أضف موظفين اثنين على الأقل قبل إنشاء الجدول.");
      showPage("team");
      return;
    }

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    if (!startInput || !endInput) {
      showToast("حقول التواريخ غير موجودة في Index.html.");
      return;
    }

    const startValue = startInput.value;
    const endValue = endInput.value;
    const settings = readScheduleSettings();
    if (!settings) return;

    const startDate = parseLocal(startValue);
    const lastDate = parseLocal(endValue);
    if (!startDate || !lastDate || lastDate < startDate) {
      showToast("تأكد من صحة تاريخ البداية والنهاية.");
      return;
    }

    // إنشاء قائمة المناوبات أولاً ثم ترتيبها زمنياً، لأن توقيت الجمعة/السبت قابل للتغيير.
    const plannedShifts = [];
    const dayCursor = new Date(startDate);
    const totalDays = Math.round((lastDate - startDate) / 86400000) + 1;
    if (totalDays > 3660) {
      showToast("الفترة طويلة جداً. اختر فترة لا تتجاوز 10 سنوات.");
      return;
    }

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const day = new Date(dayCursor);
      const weekDay = day.getDay(); // الأحد 0، الجمعة 5، السبت 6
      let startHour = 0;
      let startMinute = 0;
      let durationHours = 24;
      const weekdayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      let dayLabel = "مناوبة " + weekdayNames[weekDay];

      if (weekDay === 5) {
        [startHour, startMinute] = settings.fridayStart.split(":").map(Number);
        durationHours = 12;
        dayLabel = "مناوبة الجمعة";
      } else if (weekDay === 6) {
        [startHour, startMinute] = settings.saturdayStart.split(":").map(Number);
        durationHours = 12;
        dayLabel = "مناوبة السبت";
      }

      const shiftStart = new Date(day);
      shiftStart.setHours(startHour, startMinute, 0, 0);
      const shiftEnd = new Date(shiftStart.getTime() + durationHours * 3600000);

      plannedShifts.push({
        id: makeId(),
        dayLabel,
        start: shiftStart,
        end: shiftEnd,
        hours: durationHours
      });
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    plannedShifts.sort((a, b) => a.start - b.start);

    const lastEndByMember = new Map();
    const hoursByMember = new Map(members.map(member => [member.id, 0]));
    const countByMember = new Map(members.map(member => [member.id, 0]));
    const shifts = [];
    let orderedPointer = 0;

    for (let index = 0; index < plannedShifts.length; index++) {
      const planned = plannedShifts[index];
      const startMs = planned.start.getTime();
      const restMs = settings.restHours * 3600000;

      const available = members.filter(member => {
        const previousEnd = lastEndByMember.get(member.id);
        return previousEnd === undefined || startMs - previousEnd >= restMs;
      });

      let selected = null;
      if (available.length) {
        if (settings.orderMode === "ordered") {
          for (let step = 0; step < members.length; step++) {
            const candidateIndex = (orderedPointer + step) % members.length;
            const candidate = members[candidateIndex];
            if (available.some(person => person.id === candidate.id)) {
              selected = candidate;
              orderedPointer = (candidateIndex + 1) % members.length;
              break;
            }
          }
        } else {
          available.sort((a, b) => {
            const hourDiff = hoursByMember.get(a.id) - hoursByMember.get(b.id);
            if (hourDiff) return hourDiff;
            const countDiff = countByMember.get(a.id) - countByMember.get(b.id);
            if (countDiff) return countDiff;
            return members.findIndex(person => person.id === a.id) - members.findIndex(person => person.id === b.id);
          });
          selected = available[0];
        }
      }

      shifts.push({
        id: planned.id,
        number: index + 1,
        dayLabel: planned.dayLabel,
        start: planned.start.toISOString(),
        end: planned.end.toISOString(),
        hours: planned.hours,
        covered: Boolean(selected),
        memberId: selected ? selected.id : null,
        memberName: selected ? selected.name : "غير مغطاة"
      });

      if (selected) {
        lastEndByMember.set(selected.id, planned.end.getTime());
        hoursByMember.set(selected.id, hoursByMember.get(selected.id) + planned.hours);
        countByMember.set(selected.id, countByMember.get(selected.id) + 1);
      }
    }

    savedSchedule = {
      shifts,
      stats: [],
      startDate: startValue,
      endDate: endValue,
      settings: { ...settings },
      generatedAt: new Date().toISOString()
    };

    recalcStats();
    if (!persistSchedule()) {
      showToast("تعذر حفظ الجدول. تحقق من مساحة التخزين.");
      return;
    }

    renderSchedule();
    updateHome();

    const coveredCount = shifts.filter(shift => shift.covered).length;
    const uncoveredCount = shifts.length - coveredCount;
    showToast(uncoveredCount
      ? `تم إنشاء الجدول: ${coveredCount} مغطاة و${uncoveredCount} غير مغطاة. راجع مدة الراحة أو عدد الموظفين.`
      : "تم إنشاء الجدول وتغطية جميع المناوبات بنجاح.");
  } catch (error) {
    console.error("Shiftly schedule generation error:", error);
    showToast("تعذر إنشاء الجدول: " + (error.message || "خطأ غير معروف"));
  }
}

function recalcStats() {
  const shifts = Array.isArray(savedSchedule.shifts) ? savedSchedule.shifts : [];
  savedSchedule.stats = members.map(member => {
    const assigned = shifts.filter(shift => shift.covered && shift.memberId === member.id);
    return {
      memberId: member.id,
      memberName: member.name,
      shifts: assigned.length,
      hours: assigned.reduce((sum, shift) => sum + Number(shift.hours || 0), 0)
    };
  });
  return savedSchedule.stats;
}

function renderSchedule() {
  const container = document.getElementById("scheduleList");
  if (!container) return;
  const shifts = Array.isArray(savedSchedule.shifts) ? savedSchedule.shifts : [];
  const covered = shifts.filter(shift => shift.covered).length;
  const gaps = shifts.length - covered;
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText("scheduleTotal", shifts.length);
  setText("scheduleCovered", covered);
  setText("scheduleGaps", gaps);
  setText("schedulePeriod", savedSchedule.startDate && savedSchedule.endDate
    ? `${savedSchedule.startDate} ← ${savedSchedule.endDate}` : "لا يوجد جدول");

  if (!shifts.length) {
    container.innerHTML = '<div class="empty-state">لا يوجد جدول حالياً. أنشئ جدول المناوبات لعرضه هنا.</div>';
    return;
  }

  container.innerHTML = shifts.map((shift, index) => `
    <article class="shift-card">
      <div class="shift-top">
        <div>
          <div class="shift-number">${esc(shift.dayLabel || `المناوبة رقم ${shift.number || index + 1}`)}</div>
          <div class="shift-details">البداية: ${esc(formatDate(shift.start))}</div>
          <div class="shift-details">النهاية: ${esc(formatDate(shift.end))}</div>
          <div class="shift-details">المدة: ${Number(shift.hours || 0)} ساعة</div>
          <div class="shift-details">الموظف: ${esc(shift.memberName || "غير مغطاة")}</div>
        </div>
        <span class="status ${shift.covered ? "covered" : "uncovered"}">${shift.covered ? "مغطاة" : "غير مغطاة"}</span>
      </div>
      <div class="card-actions">
        <button class="small-btn" onclick="openShiftEdit('${esc(shift.id)}')">✎ تعديل الموظف</button>
        <button class="small-btn delete" onclick="deleteCurrentShift('${esc(shift.id)}')">✕ حذف</button>
      </div>
    </article>
  `).join("");
}

function openShiftEdit(shiftId) {
  const shift = savedSchedule.shifts.find(item => item.id === shiftId);
  if (!shift) return showToast("لم يتم العثور على المناوبة.");
  if (!members.length) return showToast("أضف موظفاً أولاً.");
  const choices = members.map((member, index) => `${index + 1} - ${member.name}`).join("\n");
  const currentIndex = shift.memberId ? members.findIndex(member => member.id === shift.memberId) + 1 : 0;
  const answer = prompt(`اختر الموظف الذي سيغطي المناوبة:\n${choices}\n\nاكتب 0 لجعلها غير مغطاة.`, String(currentIndex));
  if (answer === null) return;
  const choice = Number(answer);
  if (!Number.isInteger(choice) || choice < 0 || choice > members.length) return showToast("رقم الاختيار غير صحيح.");
  if (choice === 0) {
    shift.covered = false;
    shift.memberId = null;
    shift.memberName = "غير مغطاة";
  } else {
    const member = members[choice - 1];
    if (!canAssignShift(member.id, shift)) return showToast("الموظف لديه مناوبة متداخلة أو لا يملك الراحة الكافية.");
    shift.covered = true;
    shift.memberId = member.id;
    shift.memberName = member.name;
  }
  recalcStats();
  if (!persistSchedule()) return;
  renderSchedule();
  updateHome();
  showToast("تم تحديث المناوبة.");
}

function canAssignShift(memberId, targetShift) {
  const restMs = Number(savedSchedule.settings?.restHours ?? appSettings.restHours) * 3600000;
  const targetStart = new Date(targetShift.start).getTime();
  const targetEnd = new Date(targetShift.end).getTime();
  if (!Number.isFinite(targetStart) || !Number.isFinite(targetEnd) || targetEnd <= targetStart) return false;
  return savedSchedule.shifts.filter(shift => shift.id !== targetShift.id && shift.covered && shift.memberId === memberId).every(shift => {
    const otherStart = new Date(shift.start).getTime();
    const otherEnd = new Date(shift.end).getTime();
    return targetEnd + restMs <= otherStart || otherEnd + restMs <= targetStart;
  });
}

function deleteCurrentShift(shiftId) {
  if (!confirm("هل تريد حذف هذه المناوبة؟")) return;
  savedSchedule.shifts = savedSchedule.shifts.filter(shift => shift.id !== shiftId);
  savedSchedule.shifts.forEach((shift, index) => { shift.number = index + 1; });
  recalcStats();
  if (!persistSchedule()) return;
  renderSchedule();
  updateHome();
  showToast("تم حذف المناوبة.");
}

function deleteCurrentSchedule() {
  if (!savedSchedule.shifts?.length) return showToast("لا يوجد جدول لحذفه.");
  if (!confirm("هل أنت متأكد من حذف الجدول بالكامل؟")) return;
  savedSchedule = { shifts: [], stats: [], startDate: "", endDate: "", settings: {} };
  if (!persistSchedule()) return;
  renderSchedule();
  updateHome();
  showToast("تم حذف الجدول.");
}
