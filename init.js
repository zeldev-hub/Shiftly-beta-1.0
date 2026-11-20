"use strict";

function initializeShiftly() {
  try {
    loadApplicationData();
    setDefaultDates();

    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    if (startInput && savedSchedule.startDate) startInput.value = savedSchedule.startDate;
    if (endInput && savedSchedule.endDate) endInput.value = savedSchedule.endDate;

    renderMembers();
    recalcStats();
    renderSchedule();
    updateHome();

    const lastSaved = document.getElementById("lastSaved");
    if (lastSaved && (members.length || savedSchedule.shifts.length)) {
      lastSaved.textContent = "تم تحميل بياناتك المحفوظة من هذا الجهاز.";
    }
    // Register offline support when hosted on HTTPS or localhost.
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js", { scope: "./" })
          .then(function (registration) {
            console.info("Shiftly offline support is active.", registration.scope);
          })
          .catch(function (error) {
            console.warn("Shiftly service worker registration failed:", error);
          });
      }, { once: true });
    }

    console.info("Shiftly initialized successfully.");
  } catch (error) {
    console.error("Shiftly startup error:", error);
    showToast("حدث خطأ أثناء تشغيل التطبيق: " + (error.message || "خطأ غير معروف"));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeShiftly, { once: true });
} else {
  initializeShiftly();
}
