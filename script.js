// ══════════════════════════════════════════════════════════
//  RIT BUS-ATTENDANCE SYSTEM  —  script.js
//  Database : Firebase Firestore
// ══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  setDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


// ── Firebase config ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC0x99UpF3d-veVnZdDvTugjhP0Q7FeDus",
  authDomain: "rit-bus-attendance.firebaseapp.com",
  projectId: "rit-bus-attendance",
  storageBucket: "rit-bus-attendance.firebasestorage.app",
  messagingSenderId: "495596990137",
  appId: "1:495596990137:web:deeaa23cee45ff412e3568",
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ══════════════════════════════════════════════════════════
//  📍 ADMIN LOCATION TRACKING
//  - Starts watchPosition and saves every GPS update to Firestore
//  - Returns a Promise that resolves after the FIRST fix is saved
//  - Also returns the watchId so the caller can stop it if needed
// ══════════════════════════════════════════════════════════
let locationWatchId = null; // global so we can stop the old watcher before starting a new one

function startAdminLocationTracking(userId, bus) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return reject(new Error("Geolocation not supported"));
    }

    // Stop any existing watcher before starting a new one (prevents duplicates)
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }

    let firstFixSaved = false;

    locationWatchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        try {
          await setDoc(doc(db, "admin_locations", userId), {
            bus,
            lat: latitude,
            lng: longitude,
            updatedAt: new Date().toISOString()
          });

          console.log("📍 Live location saved:", latitude, longitude);

          if (!firstFixSaved) {
            firstFixSaved = true;
            resolve();
          }
        } catch (err) {
          console.error("❌ Failed to save location:", err);
          if (!firstFixSaved) reject(err);
        }
      },
      (error) => {
        console.error("❌ Location error:", error);
        if (!firstFixSaved) reject(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  });
}


// ══════════════════════════════════════════════════════════
//  BUS LABEL MAP
// ══════════════════════════════════════════════════════════
const BUS_LABELS = {
  bus1:"R-01 Ennore",           bus2:"R-01A Tondiarpet",
  bus3:"R-01B Kasimedu",        bus4:"R-02 Triplicane",
  bus5:"R-03 Choolai",          bus6:"R-03A Collector Nagar",
  bus7:"R-03B Water Tank",      bus8:"R-04 East Mogappair",
  bus9:"R-05 CIT Nagar",        bus10:"R-05A Loyola College",
  bus11:"R-06 Chinmayanagar",   bus12:"R-07 Santhome",
  bus13:"R-08 Kovilambakkam",   bus14:"R-08A Adambakkam",
  bus15:"R-09 MKB Nagar",       bus16:"R-09A Perambur",
  bus17:"R-10 Thachoor",        bus18:"R-11 Chengalpattu",
  bus19:"R-11A Guduvanchery",   bus20:"R-12 Minjur",
  bus21:"R-13 Vyasarpadi",      bus22:"R-13A ICF",
  bus23:"R-14 Thiruvallur",     bus24:"R-14A Kakkalur",
  bus25:"R-15 Kancheepuram",    bus26:"R-15A Orikkai",
  bus27:"R-16 Neelangkarai",    bus28:"R-16A Guindy",
  bus29:"R-16B Sholinganallur", bus30:"R-17 Valluvarkottam",
  bus31:"R-17A Valasaravakkam", bus32:"R-18 Pallikaranai",
  bus33:"R-18A Sembakkam",      bus34:"R-18B Kelambakkam",
  bus35:"R-19 Poombukar",       bus36:"R-19A Vinayagapuram",
  bus37:"R-20 Vepampattu",      bus38:"R-21 Ayyapakkam",
  bus39:"R-22 Thiruthani",      bus40:"R-22A SR Gate",
  bus41:"R-23 K4 Police Stn",   bus42:"R-24 Arcot",
  bus43:"R-25 Kallikuppam",     bus44:"R-25A Pudur",
  bus45:"R-26 Andarkuppam",     bus46:"R-27 Avadi",
  bus47:"R-27A Kollumedu",      bus48:"R-28 Agaram",
  bus49:"R-29 Velachery",       bus50:"R-29A Pammal",
  bus51:"R-29B Sivanthangalllll",
};

// ══════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ══════════════════════════════════════════════════════════

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

function startLiveClock() {
  const el = document.getElementById("liveDate");
  if (!el) return;
  const DAYS   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const tick = () => {
    const n = new Date();
    el.textContent =
      `${DAYS[n.getDay()]}, ${n.getDate()} ${MONTHS[n.getMonth()]} ${n.getFullYear()}` +
      `  |  ${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}:${String(n.getSeconds()).padStart(2,"0")}`;
  };
  tick();
  setInterval(tick, 1000);
}

function populateBusSelects() {
  ["bus", "managerBus", "mainBus"].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    Object.entries(BUS_LABELS).forEach(([key, label]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = label;
      sel.appendChild(opt);
    });
  });
}

window.toggleMenu = function () {
  document.getElementById("navLinks")?.classList.toggle("active");
  document.querySelector(".overlay")?.classList.toggle("active");
};

function triggerDownload(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════
//  PAGE DETECTION
// ══════════════════════════════════════════════════════════
const PAGE = (() => {
  const p = location.pathname.split("/").pop() || "index.html";
  if (p === "" || p === "index.html")  return "index";
  if (p === "student.html")            return "student";
  if (p === "admin.html")              return "admin";
  if (p === "dashboard.html")          return "dashboard";
  if (p === "manager.html")            return "manager";
  if (p === "main_dashboard.html")     return "main_dashboard";
  return "unknown";
})();

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  populateBusSelects();
  switch (PAGE) {
    case "index":          initIndex();         break;
    case "student":        initStudent();       break;
    case "admin":          initAdmin();         break;
    case "dashboard":      initDashboard();     break;
    case "manager":        initManager();       break;
    case "main_dashboard": initMainDashboard(); break;
  }
});

// ══════════════════════════════════════════════════════════
//  INDEX PAGE
// ══════════════════════════════════════════════════════════
function initIndex() {
  // Static page — navigation handled by <a> links
}

// ══════════════════════════════════════════════════════════
//  STUDENT PAGE  —  Mark attendance
// ══════════════════════════════════════════════════════════
function initStudent() {
  const form = document.getElementById("studentForm");

  // 🔒 CHECK DEVICE LOCK (3 hours)
  const lockTime = localStorage.getItem("attendanceLock");

  // 🔄 Auto-fill student details
  const savedName  = localStorage.getItem("studentName");
  const savedReg   = localStorage.getItem("studentReg");
  const savedDept  = localStorage.getItem("studentDept");
  const savedBus   = localStorage.getItem("studentBus");
  const savedStop  = localStorage.getItem("studentStop");

  if (savedName) document.getElementById("name").value  = savedName;
  if (savedReg)  document.getElementById("regno").value = savedReg;
  if (savedDept) document.getElementById("dept").value  = savedDept;
  if (savedBus)  document.getElementById("bus").value   = savedBus;
  if (savedStop) document.getElementById("stop").value  = savedStop;

  if (lockTime) {
    const diffHours = (Date.now() - parseInt(lockTime)) / (1000 * 60 * 60);
    if (diffHours < 3) {
      alert("⛔ You have already marked attendance. Try again after 3 hours.");
      window.location.href = "index.html";
      return;
    } else {
      localStorage.removeItem("attendanceLock");
    }
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("markBtn");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Marking..."; }

    function getDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) *
        Math.cos(lat2 * Math.PI/180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    const name  = document.getElementById("name").value.trim();
    const regno = document.getElementById("regno").value.trim();
    const dept  = document.getElementById("dept").value.trim();
    const bus   = document.getElementById("bus").value;
    const stop  = document.getElementById("stop").value.trim();

    const regPattern = /^[a-zA-Z0-9]{10,15}$/;
    if (!regPattern.test(regno)) {
      alert("❌ Invalid Register Number");
      if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
      return;
    }

    if (!name || !regno || !dept || !bus || !stop) {
      alert("⚠️ Please fill in all fields.");
      if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
      return;
    }

    const todayDate = getTodayDate();

    try {
      // Cross-bus duplicate check
      const dupQuery = query(
        collection(db, "attendance", todayDate, "records"),
        where("regno", "==", regno),
        where("date",  "==", todayDate)
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        alert(`⚠️ Attendance already marked for Register No: ${regno} today.`);
        if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const studentLat = pos.coords.latitude;
          const studentLng = pos.coords.longitude;
          console.log("📍 Student Location:", studentLat, studentLng);

          // --- FIX: Check admin session expiry using loginTime FIRST ---
          // This works even if the admin closed their browser/tab
          const adminDoc = await getDoc(doc(db, "active_admins", bus));

          if (!adminDoc.exists()) {
            alert("❌ No admin session found for this bus.");
            if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
            return;
          }

          const adminData = adminDoc.data();
          const loginTime = new Date(adminData.loginTime);
          const diffHours = (new Date() - loginTime) / (1000 * 60 * 60);

          // If 3 hours have passed OR active was already set to false → expire it now
          if (diffHours >= 3 || !adminData.active) {
            await setDoc(doc(db, "active_admins", bus), { active: false }, { merge: true });
            alert("❌ Admin session expired. Bus attendance is closed.");
            if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
            return;
          }

          // --- Now check location ---
          const locQuery = query(
            collection(db, "admin_locations"),
            where("bus", "==", bus)
          );
          const snap = await getDocs(locQuery);

          if (snap.empty) {
            alert("⏳ Waiting for admin location... Try again in a few seconds.");
            if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
            return;
          }

          let admin = null;
          snap.forEach(docSnap => {
            const data = docSnap.data();
            if (!admin || new Date(data.updatedAt) > new Date(admin.updatedAt)) {
              admin = data;
            }
          });

          console.log("🚌 Admin Location:", admin.lat, admin.lng);
          console.log("⏱ Last Updated:", admin.updatedAt);

          // Check location freshness
          const lastUpdate  = new Date(admin.updatedAt);
          const diffMinutes = (new Date() - lastUpdate) / (1000 * 60);

          if (diffMinutes > 30) {
            alert("❌ Bus location is outdated. Ask admin to refresh their location.");
            if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
            return;
          }

          const distance = getDistance(studentLat, studentLng, admin.lat, admin.lng);
          console.log("📏 Distance (km):", distance);

          if (distance > 2) {
            alert(`❌ Too far from bus (${(distance * 1000).toFixed(0)} meters)`);
            if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
            return;
          }

          // ✅ SAVE ATTENDANCE
          await setDoc(doc(db, "attendance", todayDate, "records", regno), {
            name,
            regno,
            dept,
            bus,
            busLabel: BUS_LABELS[bus],
            stop,
            date: todayDate,
            time: getCurrentTime(),
            admin: adminData.email,
            device: adminData.device
          });

          alert("✅ Attendance marked successfully!");

          // 💾 Save student details for next time
          localStorage.setItem("studentName", name);
          localStorage.setItem("studentReg",  regno);
          localStorage.setItem("studentDept", dept);
          localStorage.setItem("studentBus",  bus);
          localStorage.setItem("studentStop", stop);

          // 🔒 Store lock time
          localStorage.setItem("attendanceLock", Date.now());

          window.location.href = "index.html";
        },
        (error) => {
          alert("❌ Location access is required to mark attendance.");
          if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
        }
      );
    } catch (err) {
      console.error("Student submit error:", err);
      alert("❌ Failed to save attendance.");
      if (btn) { btn.disabled = false; btn.textContent = "Mark Attendance"; }
    }
  });
}

// ══════════════════════════════════════════════════════════
//  ADMIN PAGE  —  Firebase Auth login
// ══════════════════════════════════════════════════════════
function initAdmin() {
  onAuthStateChanged(auth, (user) => {
    if (user && sessionStorage.getItem("adminBus")) {
      window.location.href = "dashboard.html";
    }
  });

  // 🔄 Auto-fill last login
  const savedEmail = localStorage.getItem("lastAdminEmail");
  const savedBus   = localStorage.getItem("lastAdminBus");

  if (savedEmail) {
    const emailInput = document.getElementById("adminUser");
    if (emailInput) emailInput.value = savedEmail;
  }
  if (savedBus) {
    const busSelect = document.getElementById("bus");
    if (busSelect) busSelect.value = savedBus;
  }
}

function getDeviceName() {
  return navigator.userAgent;
}

window.adminLogin = async function () {
  const email = document.getElementById("adminUser").value.trim();
  const pass  = document.getElementById("adminPass").value.trim();
  const bus   = document.getElementById("bus").value;

  if (!email || !pass) {
    alert("⚠️ Please enter your email and password.");
    return;
  }
  if (!bus) {
    alert("⚠️ Please select a bus route.");
    return;
  }

  const btn = document.querySelector("#adminForm button");
  if (btn) { btn.disabled = true; btn.textContent = "Logging in…"; }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;

    // ✅ Check if bus already has an active admin whose session has NOT expired
    const existingAdmin = await getDoc(doc(db, "active_admins", bus));
    if (existingAdmin.exists() && existingAdmin.data().active) {
      const existingLoginTime = new Date(existingAdmin.data().loginTime);
      const existingDiffHours = (new Date() - existingLoginTime) / (1000 * 60 * 60);

      if (existingDiffHours < 3) {
        // Truly still active
        alert("❌ This bus already has an active admin session!");
        await signOut(auth);
        if (btn) { btn.disabled = false; btn.textContent = "Login"; }
        return;
      } else {
        // Old session expired — auto-clear it so this admin can take over
        await setDoc(doc(db, "active_admins", bus), { active: false }, { merge: true });
      }
    }

    // ✅ Save admin session in Firestore
    await setDoc(doc(db, "active_admins", bus), {
      email: user.email,
      bus: bus,
      device: getDeviceName(),
      loginTime: new Date().toISOString(),
      active: true
    });

    await setDoc(doc(db, "admins", email), {
      email: email,
      bus: bus,
      device: getDeviceName(),
      loginTime: new Date().toISOString(),
      active: true
    });

    // ✅ Get first GPS fix and save BEFORE redirecting
    if (btn) { btn.textContent = "📍 Getting location…"; }
    try {
      await startAdminLocationTracking(user.uid, bus);
    } catch (locErr) {
      console.warn("⚠️ Could not get GPS fix on login:", locErr);
      alert("⚠️ Location access failed. Students may not be able to mark attendance until your location is detected. Make sure location permission is granted.");
    }

    sessionStorage.setItem("adminBus", bus);
    localStorage.setItem("lastAdminEmail", email);
    localStorage.setItem("lastAdminBus", bus);
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("Admin login error:", err.code, err.message);
    const errorMap = {
      "auth/user-not-found":         "❌ No account found with this email.",
      "auth/wrong-password":         "❌ Incorrect password. Please try again.",
      "auth/invalid-email":          "❌ Invalid email address format.",
      "auth/too-many-requests":      "❌ Too many failed attempts. Try again later.",
      "auth/invalid-credential":     "❌ Invalid email or password.",
      "auth/network-request-failed": "❌ Network error. Check your connection.",
    };
    alert(errorMap[err.code] || `❌ Login failed: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Login"; }
  }
};

// ══════════════════════════════════════════════════════════
//  DASHBOARD PAGE  —  Admin real-time view
//  FIX: Location tracking is RESTARTED here after login redirect
//  FIX: Session expiry also stops location watcher cleanly
// ══════════════════════════════════════════════════════════
let dashboardUnsubscribe = null;

function initDashboard() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert("⚠️ Session expired. Please log in again.");
      window.location.href = "admin.html";
      return;
    }

    const bus = sessionStorage.getItem("adminBus");

    if (!bus) {
      alert("⚠️ No bus selected. Please log in again.");
      window.location.href = "admin.html";
      return;
    }

    // ✅ FIX 1: Restart location tracking on dashboard load
    // The watchPosition from admin login was killed by the page redirect.
    // We restart it here so the admin's location keeps updating in Firestore.
    startAdminLocationTracking(user.uid, bus).catch(err => {
      console.warn("⚠️ Location tracking failed on dashboard:", err);
    });

    // ✅ FIX 2: Session expiry — check immediately and every minute
    const checkSessionExpiry = async () => {
      if (!bus) return;

      const adminDoc = await getDoc(doc(db, "active_admins", bus));
      if (!adminDoc.exists()) return;

      const data = adminDoc.data();
      if (!data.loginTime) return;

      const loginTime  = new Date(data.loginTime);
      const diffHours  = (new Date() - loginTime) / (1000 * 60 * 60);

      if (diffHours >= 3) {
        alert("⏰ Your session has expired (3 hours). Please log in again.");

        // Set active: false in Firestore (this is the important part)
        await setDoc(doc(db, "active_admins", bus), { active: false }, { merge: true });

        // Also clear the admin_locations document
        await deleteDoc(doc(db, "admin_locations", user.uid));

        // Stop location watcher
        if (locationWatchId !== null) {
          navigator.geolocation.clearWatch(locationWatchId);
          locationWatchId = null;
        }

        await signOut(auth);
        sessionStorage.removeItem("adminBus");
        window.location.href = "admin.html";
      }
    };

    checkSessionExpiry();
    setInterval(checkSessionExpiry, 60000);

    // Show bus name
    const busNameEl = document.getElementById("busNameDisplay");
    if (busNameEl) busNameEl.textContent = `Bus Route : ${BUS_LABELS[bus] || bus}`;

    // Real-time attendance listener for this bus, today only
    const q = query(
      collection(db, "attendance", getTodayDate(), "records"),
      where("bus", "==", bus),
      orderBy("time")
    );

    dashboardUnsubscribe = onSnapshot(q, (snapshot) => {
      const tbody = document.getElementById("tableBody");
      if (!tbody) return;
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">No attendance records yet.</td></tr>`;
        return;
      }

      let sno = 1;
      snapshot.forEach((docSnap) => {
        const r  = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${sno++}</td>
          <td>${r.name  || "—"}</td>
          <td>${r.regno || "—"}</td>
          <td>${r.dept  || "—"}</td>
          <td>${r.stop  || "—"}</td>
          <td>${r.date  || "—"}</td>
          <td>${r.time  || "—"}</td>
        `;
        tbody.appendChild(tr);
      });
    });
  });
}

window.logout = async function () {
  const bus  = sessionStorage.getItem("adminBus");
  const user = auth.currentUser;

  if (bus) {
    await setDoc(doc(db, "active_admins", bus), { active: false }, { merge: true });
  }

  if (user) {
    await setDoc(doc(db, "admin_locations", user.uid), {
  active: false
}, { merge: true });
  }

  // Stop location watcher on manual logout too
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }

  if (dashboardUnsubscribe) dashboardUnsubscribe();
  try { await signOut(auth); } catch (_) {}

  sessionStorage.removeItem("adminBus");
  window.location.href = "index.html";
};

// ── Dashboard download helpers ────────────────────────────

function getDashboardRows() {
  const rows = document.querySelectorAll("#tableBody tr");
  const data = [];
  rows.forEach((tr) => {
    const c = tr.querySelectorAll("td");
    if (c.length < 7) return;
    data.push({
      sno:   c[0].textContent,
      name:  c[1].textContent,
      regno: c[2].textContent,
      dept:  c[3].textContent,
      stop:  c[4].textContent,
      date:  c[5].textContent,
      time:  c[6].textContent,
    });
  });
  return data;
}

window.downloadData = function () {
  const data = getDashboardRows();
  if (!data.length) { alert("No data to download."); return; }
  const bus   = sessionStorage.getItem("adminBus") || "bus";
  const label = BUS_LABELS[bus] || bus;
  const csv = [
    ["S.no","Name","Register Number","Department","Boarding Stop","Date","Time"].join(","),
    ...data.map(r => [r.sno, `"${r.name}"`, r.regno, `"${r.dept}"`, `"${r.stop}"`, r.date, r.time].join(",")),
  ].join("\n");
  triggerDownload(`attendance_${label}_${getTodayDate().replace(/\//g,"-")}.csv`, "text/csv", csv);
};

window.downloadPDF = function () {
  const data = getDashboardRows();
  if (!data.length) { alert("No data to download."); return; }
  const bus   = sessionStorage.getItem("adminBus") || "bus";
  const label = BUS_LABELS[bus] || bus;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`RIT Bus Attendance — ${label}  (${getTodayDate()})`, 14, 15);
  doc.autoTable({
    startY: 22,
    head: [["S.no","Name","Reg No","Dept","Stop","Date","Time"]],
    body: data.map(r => [r.sno, r.name, r.regno, r.dept, r.stop, r.date, r.time]),
    styles:     { fontSize: 9 },
    headStyles: { fillColor: [64, 98, 220] },
  });
  doc.save(`attendance_${label}_${getTodayDate().replace(/\//g,"-")}.pdf`);
};

window.printTable = function () { window.print(); };

// ══════════════════════════════════════════════════════════
//  MANAGER PAGE  —  Bus-wise attendance (real-time)
// ══════════════════════════════════════════════════════════
let managerUnsubscribe = null;

function initManager() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("⚠️ Access denied. Please login.");
      window.location.href = "admin.html";
      return;
    }

    const bus = sessionStorage.getItem("adminBus");
    if (!bus) {
      alert("⚠️ Invalid session. Login again.");
      window.location.href = "admin.html";
      return;
    }

    try {
      const adminDoc = await getDoc(doc(db, "active_admins", bus));
      if (!adminDoc.exists()) {
        alert("⚠️ No active admin found. Login again.");
        window.location.href = "admin.html";
        return;
      }

      const data = adminDoc.data();
      if (data.email !== user.email) {
        alert("⛔ Unauthorized access!");
        window.location.href = "admin.html";
        return;
      }

      console.log("✅ Manager access granted");
    } catch (err) {
      console.error("Manager auth error:", err);
      alert("❌ Error verifying access.");
      window.location.href = "admin.html";
    }
  });
}

window.loadBusData = function () {
  const bus = document.getElementById("managerBus").value;
  if (!bus) { alert("⚠️ Please select a bus route."); return; }

  const nameEl = document.getElementById("managerBusName");
  if (nameEl) nameEl.textContent = `Showing : ${BUS_LABELS[bus] || bus}`;

  if (managerUnsubscribe) { managerUnsubscribe(); managerUnsubscribe = null; }

  const q = query(
    collection(db, "attendance", getTodayDate(), "records"),
    where("bus",  "==", bus),
    where("date", "==", getTodayDate()),
    orderBy("time")
  );

  managerUnsubscribe = onSnapshot(q, (snapshot) => {
    const tbody = document.getElementById("managerTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">No records found for this bus.</td></tr>`;
      return;
    }

    let sno = 1;
    snapshot.forEach((docSnap) => {
      const r  = docSnap.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sno++}</td>
        <td>${r.name  || "—"}</td>
        <td>${r.regno || "—"}</td>
        <td>${r.dept  || "—"}</td>
        <td>${r.stop  || "—"}</td>
        <td>${r.date  || "—"}</td>
        <td>${r.time  || "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  });
};

function getManagerRows() {
  const bus  = document.getElementById("managerBus")?.value || "";
  const rows = document.querySelectorAll("#managerTable tr");
  const data = [];
  rows.forEach((tr) => {
    const c = tr.querySelectorAll("td");
    if (c.length < 7) return;
    data.push({
      sno:   c[0].textContent,
      name:  c[1].textContent,
      regno: c[2].textContent,
      dept:  c[3].textContent,
      stop:  c[4].textContent,
      date:  c[5].textContent,
      time:  c[6].textContent,
      bus:   BUS_LABELS[bus] || bus,
    });
  });
  return data;
}

window.downloadManagerCSV = function () {
  const data = getManagerRows();
  if (!data.length) { alert("No data to download."); return; }
  const label = data[0].bus;
  const csv = [
    ["S.no","Name","Reg No","Department","Stop","Date","Time"].join(","),
    ...data.map(r => [r.sno, `"${r.name}"`, r.regno, `"${r.dept}"`, `"${r.stop}"`, r.date, r.time].join(",")),
  ].join("\n");
  triggerDownload(`manager_${label}_${getTodayDate().replace(/\//g,"-")}.csv`, "text/csv", csv);
};

window.downloadManagerPDF = function () {
  const data = getManagerRows();
  if (!data.length) { alert("No data to download."); return; }
  const label = data[0].bus;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`RIT Bus Attendance — ${label}  (${getTodayDate()})`, 14, 15);
  doc.autoTable({
    startY: 22,
    head: [["S.no","Name","Reg No","Dept","Stop","Date","Time"]],
    body: data.map(r => [r.sno, r.name, r.regno, r.dept, r.stop, r.date, r.time]),
    styles:     { fontSize: 9 },
    headStyles: { fillColor: [3, 41, 98] },
  });
  doc.save(`manager_${label}_${getTodayDate().replace(/\//g,"-")}.pdf`);
};

// ══════════════════════════════════════════════════════════
//  MAIN DASHBOARD  —  All buses combined overview
// ══════════════════════════════════════════════════════════
function initMainDashboard() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert("⚠️ Unauthorized access");
      window.location.href = "admin.html";
    }
  });
}

window.loadMainData = async function (e) {
  if (e) e.preventDefault();

  const selected = document.getElementById("mainBus")?.value || "all";
  const tbody    = document.getElementById("mainTable");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;">⏳ Loading…</td></tr>`;

  try {
    let q;
    if (selected === "all") {
      q = query(
        collection(db, "attendance", getTodayDate(), "records"),
        orderBy("bus"),
        orderBy("time")
      );
    } else {
      q = query(
        collection(db, "attendance", getTodayDate(), "records"),
        where("bus",  "==", selected),
        orderBy("time")
      );
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888;">No attendance data found.</td></tr>`;
      return;
    }

    const records = [];
    snapshot.forEach((docSnap) => {
      const r = docSnap.data();
      records.push({
        bus:   BUS_LABELS[r.bus] || r.bus || "—",
        name:  r.name  || "—",
        regno: r.regno || "—",
        dept:  r.dept  || "—",
        stop:  r.stop  || "—",
        date:  r.date  || "—",
        time:  r.time  || "—",
      });
    });

    tbody.innerHTML = "";
    records.forEach((r, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.bus}</td>
        <td>${r.name}</td>
        <td>${r.regno}</td>
        <td>${r.dept}</td>
        <td>${r.stop}</td>
        <td>${r.date}</td>
        <td>${r.time}</td>
      `;
      tbody.appendChild(tr);
    });

    window._mainData = records;

  } catch (err) {
    console.error("Main dashboard error:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;padding:20px;">❌ Error loading data. Check console.</td></tr>`;
  }
};

window.downloadMainCSV = function () {
  const data = window._mainData || [];
  if (!data.length) { alert("Please click 'Load Data' first."); return; }
  const csv = [
    ["S.no","Bus","Name","Reg No","Department","Stop","Date","Time"].join(","),
    ...data.map((r, i) => [i+1, `"${r.bus}"`, `"${r.name}"`, r.regno, `"${r.dept}"`, `"${r.stop}"`, r.date, r.time].join(",")),
  ].join("\n");
  triggerDownload(`all_buses_${getTodayDate().replace(/\//g,"-")}.csv`, "text/csv", csv);
};

window.downloadMainPDF = function () {
  const data = window._mainData || [];
  if (!data.length) { alert("Please click 'Load Data' first."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`RIT All-Bus Attendance  (${getTodayDate()})`, 14, 15);
  doc.autoTable({
    startY: 22,
    head: [["S.no","Bus","Name","Reg No","Dept","Stop","Date","Time"]],
    body: data.map((r, i) => [i+1, r.bus, r.name, r.regno, r.dept, r.stop, r.date, r.time]),
    styles:     { fontSize: 8 },
    headStyles: { fillColor: [64, 98, 220] },
  });
  doc.save(`all_buses_${getTodayDate().replace(/\//g,"-")}.pdf`);
};
