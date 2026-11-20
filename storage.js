
"use strict";

/* =====================================
   SHIFTLY STORAGE SYSTEM
   Export / Import / CSV / PDF / Reset
===================================== */

/* عرض ملف للمشاركة دون استعمال DownloadManager */
async function shareShiftlyFile(content, filename, mimeType) {
  try {
    if (
      typeof File !== "undefined" &&
      navigator.share &&
      navigator.canShare
    ) {
      const file = new File(
        [content],
        filename,
        { type: mimeType }
      );

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename
        });

        showToast("تم فتح قائمة مشاركة الملف.");
        return true;
      }
    }

    // إذا المشاركة غير مدعومة نعرض المحتوى للنسخ
    showExportFallback(content, filename);

    return false;

  } catch (error) {
    console.error("Share error:", error);

    if (error.name === "AbortError") {
      showToast("تم إلغاء المشاركة.");
      return false;
    }

    showExportFallback(content, filename);
    return false;
  }
}

/* عرض المحتوى للنسخ يدوياً */
function showExportFallback(content, filename) {
  const old = document.getElementById("shiftlyExportBox");

  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "shiftlyExportBox";

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:99999;
    background:rgba(0,0,0,.85);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:15px;
  `;

  const panel = document.createElement("div");

  panel.style.cssText = `
    background:#182235;
    color:white;
    width:100%;
    max-width:600px;
    max-height:90vh;
    overflow:auto;
    padding:18px;
    border-radius:15px;
    box-sizing:border-box;
  `;

  const title = document.createElement("h3");
  title.textContent = "نسخة التصدير: " + filename;

  const description = document.createElement("p");
  description.textContent =
    "المشاركة غير متاحة في هذا المتصفح. انسخ المحتوى واحفظه في ملف بالامتداد المناسب.";

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.readOnly = true;

  textarea.style.cssText = `
    width:100%;
    height:220px;
    box-sizing:border-box;
    padding:10px;
    background:#0b1220;
    color:#fff;
    border:1px solid #40516b;
    border-radius:8px;
    direction:ltr;
    font-size:12px;
    resize:vertical;
  `;

  const copyButton = document.createElement("button");
  copyButton.textContent = "نسخ المحتوى";

  copyButton.style.cssText = `
    width:100%;
    padding:13px;
    margin-top:10px;
    border:0;
    border-radius:8px;
    background:#2878ed;
    color:white;
    font-weight:bold;
  `;

  copyButton.onclick = async function () {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        textarea.focus();
        textarea.select();

        const copied = document.execCommand("copy");

        if (!copied) {
          showToast("حدد النص وانسخه يدوياً.");
          return;
        }
      }

      showToast("تم نسخ المحتوى.");
    } catch (error) {
      textarea.focus();
      textarea.select();
      showToast("حدد النص وانسخه يدوياً.");
    }
  };

  const closeButton = document.createElement("button");
  closeButton.textContent = "إغلاق";

  closeButton.style.cssText = `
    width:100%;
    padding:12px;
    margin-top:8px;
    border:1px solid #53647c;
    border-radius:8px;
    background:transparent;
    color:white;
  `;

  closeButton.onclick = function () {
    overlay.remove();
  };

  panel.appendChild(title);
  panel.appendChild(description);
  panel.appendChild(textarea);
  panel.appendChild(copyButton);
  panel.appendChild(closeButton);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

/* =====================================
   BACKUP EXPORT - JSON
===================================== */

async function exportBackup() {
  try {
    const backup = {
      application: "Shiftly",
      version: 2,
      exportedAt: new Date().toISOString(),

      members: members,

      schedule: savedSchedule,

      settings: appSettings
    };

    const content = JSON.stringify(backup, null, 2);

    const filename =
      "Shiftly-Backup-" +
      localInput(new Date()) +
      ".json";

    await shareShiftlyFile(
      content,
      filename,
      "application/json"
    );

  } catch (error) {
    console.error("Backup export error:", error);
    showToast("حدث خطأ أثناء تجهيز النسخة الاحتياطية.");
  }
}

/* =====================================
   BACKUP VALIDATION
===================================== */

function validateBackup(data) {
  if (!data || data.application !== "Shiftly") {
    return false;
  }

  if (!Array.isArray(data.members)) {
    return false;
  }

  if (
    !data.schedule ||
    !Array.isArray(data.schedule.shifts)
  ) {
    return false;
  }

  const validMembers = data.members.every(member =>
    member &&
    typeof member.id === "string" &&
    typeof member.name === "string"
  );

  const validShifts = data.schedule.shifts.every(shift =>
    shift &&
    typeof shift.start === "string" &&
    typeof shift.end === "string" &&
    Number.isFinite(Number(shift.hours))
  );

  return validMembers && validShifts;
}

/* =====================================
   BACKUP IMPORT - JSON
===================================== */

function importBackupFile(event) {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".json")) {
    showToast("اختر ملف JSON.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);

      if (!validateBackup(data)) {
        showToast("ملف النسخة الاحتياطية غير صالح.");
        return;
      }

      if (!confirm(
        "سيتم استبدال البيانات الحالية. هل تريد المتابعة؟"
      )) {
        return;
      }

      const oldMembers = members;
      const oldSchedule = savedSchedule;
      const oldSettings = appSettings;

      members = data.members;
      savedSchedule = data.schedule;

      appSettings = {
        ...appSettings,
        ...(data.settings || {})
      };

      const membersSaved = persistMembers();
      const scheduleSaved = persistSchedule();
      const settingsSaved = persistSettings();

      if (!membersSaved || !scheduleSaved || !settingsSaved) {
        members = oldMembers;
        savedSchedule = oldSchedule;
        appSettings = oldSettings;

        showToast("فشل حفظ النسخة المستوردة.");
        return;
      }

      recalcStats();

      if (!persistSchedule()) {
        showToast("تم الاستيراد لكن تعذر تحديث الإحصائيات المحفوظة.");
        return;
      }

      setDefaultDates();
      renderMembers();
      renderSchedule();
      updateHome();

      showToast("تم استيراد النسخة الاحتياطية بنجاح.");

    } catch (error) {
      console.error("Import error:", error);
      showToast("تعذر قراءة ملف JSON.");

    } finally {
      event.target.value = "";
    }
  };

  reader.onerror = function () {
    showToast("تعذرت قراءة الملف.");
    event.target.value = "";
  };

  reader.readAsText(file);
}

/* =====================================
   CSV EXPORT
===================================== */

function csvCell(value) {
  let text = String(value ?? "");

  if (/^[\s]*[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return '"' + text.replace(/"/g, '""') + '"';
}

async function exportCSV() {
  try {
    const shifts = savedSchedule.shifts || [];

    if (shifts.length === 0) {
      showToast("أنشئ جدولاً أولاً.");
      return;
    }

    const rows = [
      [
        "رقم المناوبة",
        "تاريخ البداية",
        "تاريخ النهاية",
        "الساعات",
        "الموظف",
        "الحالة"
      ]
    ];

    shifts.forEach((shift, index) => {
      rows.push([
        shift.number || index + 1,
        formatDate(shift.start),
        formatDate(shift.end),
        shift.hours,
        shift.memberName || "غير مغطاة",
        shift.covered ? "مغطاة" : "غير مغطاة"
      ]);
    });

    const csv =
      "\uFEFF" +
      rows.map(row =>
        row.map(csvCell).join(",")
      ).join("\r\n");

    const filename =
      "Shiftly-Schedule-" +
      localInput(new Date()) +
      ".csv";

    await shareShiftlyFile(
      csv,
      filename,
      "text/csv;charset=utf-8"
    );

  } catch (error) {
    console.error("CSV export error:", error);
    showToast("تعذر تجهيز ملف CSV.");
  }
}

/* =====================================
   PDF EXPORT / PRINT
===================================== */

function exportPDF() {
  try {
    const shifts = savedSchedule.shifts || [];

    if (shifts.length === 0) {
      showToast("لا يوجد جدول للطباعة.");
      return;
    }

    const rows = shifts.map((shift, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(formatDate(shift.start))}</td>
        <td>${esc(formatDate(shift.end))}</td>
        <td>${esc(shift.hours)} ساعة</td>
        <td>${esc(shift.memberName || "غير مغطاة")}</td>
        <td>${shift.covered ? "مغطاة" : "غير مغطاة"}</td>
      </tr>
    `).join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      showToast("المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Shiftly - جدول المناوبات</title>

        <style>
          body {
            font-family: Arial, Tahoma, sans-serif;
            direction: rtl;
            padding: 20px;
            color: #111;
          }

          h1, h2, p {
            text-align: center;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }

          th, td {
            border: 1px solid #999;
            padding: 9px 5px;
            text-align: center;
            font-size: 12px;
          }

          th {
            background: #e8eef8;
          }

          .actions {
            text-align: center;
            margin: 20px;
          }

          button {
            padding: 12px 25px;
            border: 0;
            background: #2466d1;
            color: white;
            border-radius: 7px;
            font-size: 15px;
          }

          @media print {
            .actions {
              display: none;
            }

            body {
              padding: 0;
            }

            tr {
              break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <h1>Shiftly</h1>
        <h2>جدول المناوبات</h2>

        <p>
          الفترة:
          ${esc(savedSchedule.startDate || "")}
          إلى
          ${esc(savedSchedule.endDate || "")}
        </p>

        <p>
          عدد المناوبات: ${shifts.length}
          |
          المغطاة: ${shifts.filter(s => s.covered).length}
          |
          غير المغطاة: ${shifts.filter(s => !s.covered).length}
        </p>

        <div class="actions">
          <button onclick="window.print()">
            طباعة / حفظ PDF
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم</th>
              <th>البداية</th>
              <th>النهاية</th>
              <th>المدة</th>
              <th>الموظف</th>
              <th>الحالة</th>
            </tr>
          </thead>

          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = function () {
      printWindow.focus();
      printWindow.print();
    };

  } catch (error) {
    console.error("PDF export error:", error);
    showToast("تعذر فتح صفحة الطباعة.");
  }
}

/* =====================================
   RESET ALL DATA
===================================== */

function resetAllData() {
  const confirmed = confirm(
    "سيتم حذف جميع الموظفين والجداول والإعدادات. هل أنت متأكد؟"
  );

  if (!confirmed) return;

  try {
    localStorage.removeItem(MEMBERS_KEY);
    localStorage.removeItem(SCHEDULE_KEY);
    localStorage.removeItem(SETTINGS_KEY);

    members = [];

    savedSchedule = {
      shifts: [],
      stats: [],
      startDate: "",
      endDate: "",
      settings: {}
    };

    appSettings = {
      workHours: 24,
      restHours: 144,
      orderMode: "balanced",
      fridayStart: "08:00",
      saturdayStart: "08:00"
    };

    setDefaultDates();
    renderMembers();
    renderSchedule();
    updateHome();

    showToast("تم حذف جميع البيانات.");

  } catch (error) {
    console.error("Reset error:", error);
    showToast("تعذر حذف البيانات.");
  }
}

/* =====================================
   IMPORT INPUT EVENT
===================================== */

const shiftlyImportInput =
  document.getElementById("importFile");

if (shiftlyImportInput) {
  shiftlyImportInput.addEventListener(
    "change",
    importBackupFile
  );
}
