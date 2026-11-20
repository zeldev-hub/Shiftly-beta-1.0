
"use strict";

function saveMember(event) {
  event.preventDefault();

  const nameInput = document.getElementById("memberName");
  const roleInput = document.getElementById("memberRole");
  const idInput = document.getElementById("memberId");

  const name = nameInput.value.trim();
  const role = roleInput.value.trim();
  const id = idInput.value;

  if (!name) {
    showToast("اكتب اسم الموظف أولاً.");
    return;
  }

  const duplicate = members.some(member =>
    member.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
    member.id !== id
  );

  if (duplicate) {
    showToast("هذا الموظف موجود بالفعل.");
    return;
  }

  if (id) {
    const index = members.findIndex(member => member.id === id);

    if (index === -1) {
      showToast("لم يتم العثور على الموظف.");
      return;
    }

    members[index] = {
      ...members[index],
      name,
      role
    };

    savedSchedule.shifts.forEach(shift => {
      if (shift.memberId === id) {
        shift.memberName = name;
      }
    });

    persistSchedule();
    showToast("تم تعديل بيانات الموظف.");
  } else {
    members.push({
      id: makeId(),
      name,
      role,
      createdAt: new Date().toISOString()
    });

    showToast("تمت إضافة الموظف بنجاح.");
  }

  if (!persistMembers()) return;

  persistSchedule();
  document.getElementById("memberForm").reset();
  document.getElementById("memberId").value = "";
  cancelMemberEdit();

  renderMembers();
  renderSchedule();
  updateHome();
}

function editMember(id) {
  const member = members.find(item => item.id === id);
  if (!member) {
    showToast("الموظف غير موجود.");
    return;
  }

  document.getElementById("memberId").value = member.id;
  document.getElementById("memberName").value = member.name;
  document.getElementById("memberRole").value = member.role || "";

  document.getElementById("memberFormTitle").textContent =
    "تعديل بيانات الموظف";

  document.getElementById("memberSubmit").textContent =
    "حفظ التعديلات";

  document.getElementById("cancelEdit").classList.remove("hidden");

  showPage("team");
  document.getElementById("memberName").focus();
}

function cancelMemberEdit() {
  const form = document.getElementById("memberForm");
  if (form) form.reset();

  document.getElementById("memberId").value = "";
  document.getElementById("memberFormTitle").textContent =
    "إضافة موظف جديد";

  document.getElementById("memberSubmit").textContent =
    "＋ إضافة الموظف";

  document.getElementById("cancelEdit").classList.add("hidden");
}

function deleteMember(id) {
  const member = members.find(item => item.id === id);
  if (!member) return;

  const confirmed = confirm(
    `هل تريد حذف الموظف "${member.name}"؟ ستصبح مناوباته غير مغطاة.`
  );

  if (!confirmed) return;

  members = members.filter(item => item.id !== id);

  savedSchedule.shifts.forEach(shift => {
    if (shift.memberId === id) {
      shift.covered = false;
      shift.memberId = null;
      shift.memberName = "غير مغطاة";
    }
  });

  persistMembers();
  persistSchedule();

  renderMembers();
  renderSchedule();
  recalcStats();
  updateHome();

  showToast("تم حذف الموظف.");
}

function renderMembers() {
  const container = document.getElementById("membersList");
  const count = document.getElementById("membersCount");

  if (!container) return;

  if (count) count.textContent = members.length;

  if (members.length === 0) {
    container.innerHTML =
      '<div class="empty-state">لا يوجد موظفون حالياً. أضف أول موظف للبدء.</div>';
    return;
  }

  container.innerHTML = members.map((member, index) => `
    <article class="member-card">
      <div class="member-top">
        <div>
          <div class="member-name">
            ${index + 1}. ${esc(member.name)}
          </div>
          <div class="member-role">
            ${esc(member.role || "بدون تحديد وظيفة")}
          </div>
        </div>
        <span class="counter">#${index + 1}</span>
      </div>
      <div class="card-actions">
        <button class="small-btn" onclick="editMember('${esc(member.id)}')">
          ✎ تعديل
        </button>
        <button class="small-btn delete" onclick="deleteMember('${esc(member.id)}')">
          ✕ حذف
        </button>
      </div>
    </article>
  `).join("");
}

const memberFormElement = document.getElementById("memberForm");
if (memberFormElement) {
  memberFormElement.addEventListener("submit", saveMember);
}
