// ==========================================================================
// DAILY DINNER TRACKER & MONTHLY BILLING APPLICATION
// ==========================================================================

const STORAGE_KEY = 'dinner_tracker_records_v1';
const SETTINGS_KEY = 'dinner_tracker_settings_v1';

// Default Settings
let settings = {
  chapathiRate: 20,          // Fixed ₹20 per chapathi
  defaultChapathiQty: 4,     // Usually 4 chapathis
  recipientName: 'Customer / Recipient',
  churchName: 'Dinner Delivery',
  momName: 'Mother',
  reminderEnabled: true,     // Send reminder if dinner not entered
  reminderTime: '21:00',     // 9:00 PM default
};

// Records Map: { "YYYY-MM-DD": { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' } }
let dinnerRecords = {};

// Calendar state
let currentDate = new Date();
let currentViewMonth = currentDate.getMonth(); // 0 - 11
let currentViewYear = currentDate.getFullYear();

// Reminder tracking
const LAST_REMINDER_KEY = 'dinner_tracker_last_reminder_v1';
let reminderIntervalTimer = null;

function safeCreateIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); } catch (e) { console.warn(e); }
  }
}

// --------------------------------------------------------------------------
// PWA & MOBILE APP INSTALLATION
// --------------------------------------------------------------------------
let deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const headerBtn = document.getElementById('install-app-btn');
  const banner = document.getElementById('pwa-install-banner');
  if (headerBtn) headerBtn.classList.remove('hidden');
  if (banner) banner.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const headerBtn = document.getElementById('install-app-btn');
  const banner = document.getElementById('pwa-install-banner');
  if (headerBtn) headerBtn.classList.add('hidden');
  if (banner) banner.classList.add('hidden');
  showToast('App installed successfully on your phone!', '📱');
});

function triggerPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Installing App...', '📲');
      }
      deferredPwaPrompt = null;
    });
  } else {
    alert('போனில் App-ஆக நிறுவ (To install as App on Phone):\n\n1. Browser-ன் வலது மேல்புறத்தில் உள்ள மூன்று புள்ளிகளை (⋮) அழுத்தவும்.\n2. "Add to Home screen" (முகப்புத் திரையில் சேர்) அல்லது "Install App" என்பதைத் தேர்ந்தெடுக்கவும்.\n\n(iPhone பயனர்கள்: Share பொத்தானை அழுத்தி "Add to Home Screen" என்பதைத் தேர்ந்தெடுக்கவும்)');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW registration:', err);
    });
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadRecords();
  initCalendar();
  updateTodayBanner();
  updateMonthStats();
  initBillViewMonth();
  initReminderSystem();
  registerServiceWorker();
  safeCreateIcons();
});

// --------------------------------------------------------------------------
// STORAGE & SETTINGS MANAGEMENT
// --------------------------------------------------------------------------

function loadSettings() {
  try {
    let saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) {
      saved = localStorage.getItem('priest_dinner_settings_v1');
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate priestName to recipientName if present
      if (parsed.priestName && !parsed.recipientName) {
        parsed.recipientName = parsed.priestName === 'Rev. Parish Priest' ? 'Customer / Recipient' : parsed.priestName;
      }
      settings = { ...settings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  syncSettingsUI();
}

function saveSettings() {
  const rateInput = document.getElementById('settings-rate');
  const qtyInput = document.getElementById('settings-default-qty');
  const recipientInput = document.getElementById('settings-priest-name');
  const momInput = document.getElementById('settings-mom-name');
  const reminderToggle = document.getElementById('settings-reminder-enabled');
  const reminderTimeInput = document.getElementById('settings-reminder-time');

  settings.chapathiRate = Math.max(1, parseInt(rateInput.value) || 20);
  settings.defaultChapathiQty = Math.max(1, parseInt(qtyInput.value) || 4);
  settings.recipientName = recipientInput.value.trim() || 'Customer / Recipient';
  settings.momName = momInput.value.trim() || 'Mother';
  settings.reminderEnabled = reminderToggle.checked;
  settings.reminderTime = reminderTimeInput.value || '21:00';

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    showToast('Settings saved successfully!', '⚙️');
  } catch (e) {
    showToast('Failed to save settings', '❌');
  }

  closeSettingsModal();
  syncSettingsUI();
  renderCalendar();
  updateTodayBanner();
  updateMonthStats();
  checkDinnerReminder();
  if (!document.getElementById('view-bill').classList.contains('hidden')) {
    renderBill();
  }
}

function syncSettingsUI() {
  document.getElementById('settings-rate').value = settings.chapathiRate;
  document.getElementById('settings-default-qty').value = settings.defaultChapathiQty;
  document.getElementById('settings-priest-name').value = settings.recipientName || 'Customer / Recipient';
  document.getElementById('settings-mom-name').value = settings.momName;
  document.getElementById('settings-reminder-enabled').checked = settings.reminderEnabled !== false;
  document.getElementById('settings-reminder-time').value = settings.reminderTime || '21:00';

  document.getElementById('modal-rate-indicator').textContent = settings.chapathiRate;
  document.getElementById('bill-fixed-rate').textContent = settings.chapathiRate;
  document.getElementById('bill-to-name').textContent = settings.recipientName || 'Customer / Recipient';
  document.getElementById('bill-from-name').textContent = settings.momName || 'Mother';
  document.getElementById('bill-signature-from').textContent = settings.momName || 'Mother';
  document.getElementById('bill-signature-to').textContent = settings.recipientName || 'Recipient Signature';

  // Quick button label
  const quickBtn = document.getElementById('quick-today-btn');
  if (quickBtn) {
    const cost = settings.defaultChapathiQty * settings.chapathiRate;
    quickBtn.querySelector('span:last-child').textContent = `Add ${settings.defaultChapathiQty} Chapathis (₹${cost})`;
  }
}

function loadRecords() {
  try {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      saved = localStorage.getItem('priest_dinner_records_v1');
    }
    if (saved) {
      dinnerRecords = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load dinner records:', e);
    dinnerRecords = {};
  }
}

function persistRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dinnerRecords));
  } catch (e) {
    console.error('Error saving records:', e);
    showToast('Error saving data to local storage', '⚠️');
  }
}

// --------------------------------------------------------------------------
// CALENDAR VIEW & NAVIGATION
// --------------------------------------------------------------------------

function initCalendar() {
  renderCalendar();
}

function changeMonth(delta) {
  currentViewMonth += delta;
  if (currentViewMonth < 0) {
    currentViewMonth = 11;
    currentViewYear -= 1;
  } else if (currentViewMonth > 11) {
    currentViewMonth = 0;
    currentViewYear += 1;
  }
  renderCalendar();
  updateMonthStats();
}

function jumpToCurrentMonth() {
  const now = new Date();
  currentViewMonth = now.getMonth();
  currentViewYear = now.getFullYear();
  renderCalendar();
  updateMonthStats();
}

function renderCalendar() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  document.getElementById('current-month-label').textContent = `${monthNames[currentViewMonth]} ${currentViewYear}`;

  const container = document.getElementById('calendar-days-container');
  container.innerHTML = '';

  const firstDayOfMonth = new Date(currentViewYear, currentViewMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentViewYear, currentViewMonth, 0).getDate();

  const todayIso = getTodayIso();

  // 1. Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const cell = document.createElement('div');
    cell.className = 'min-h-[90px] sm:min-h-[115px] p-2 bg-slate-50/50 opacity-40 select-none';
    cell.innerHTML = `<span class="text-xs font-semibold text-slate-400">${dayNum}</span>`;
    container.appendChild(cell);
  }

  // 2. Active month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = formatDateIso(currentViewYear, currentViewMonth + 1, day);
    const isToday = dateIso === todayIso;
    const record = dinnerRecords[dateIso];

    const cell = document.createElement('div');
    cell.className = `min-h-[90px] sm:min-h-[115px] p-2 sm:p-2.5 bg-white transition hover:bg-amber-50/40 cursor-pointer flex flex-col justify-between group relative border-b border-r border-slate-100 ${
      isToday ? 'ring-2 ring-brand-500 ring-inset bg-amber-50/20' : ''
    }`;
    cell.onclick = () => openEntryModal(dateIso);

    // Day Header
    let dayHeaderHtml = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs sm:text-sm font-bold ${
          isToday ? 'w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-xs' : 'text-slate-700'
        }">${day}</span>
        ${isToday ? '<span class="hidden sm:inline-block text-[10px] font-bold text-brand-600 uppercase tracking-wider">Today</span>' : ''}
      </div>
    `;

    // Badges / Summary
    let contentHtml = '<div class="space-y-1 my-auto">';
    if (record) {
      const hasChapathi = record.chapathis > 0;
      const hasOutside = record.outsideFood && record.outsideCost > 0;

      if (hasChapathi) {
        const cCost = record.chapathis * settings.chapathiRate;
        contentHtml += `
          <div class="text-[11px] leading-tight px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-semibold flex items-center justify-between">
            <span>🫓 ${record.chapathis}</span>
            <span class="font-bold text-amber-800">₹${cCost}</span>
          </div>
        `;
      }

      if (hasOutside) {
        contentHtml += `
          <div class="text-[11px] leading-tight px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 font-semibold flex items-center justify-between truncate" title="${record.outsideDesc || 'Outside Food'}">
            <span class="truncate">🥡 ${record.outsideDesc || 'Outside'}</span>
            <span class="font-bold text-purple-800 ml-1">₹${record.outsideCost}</span>
          </div>
        `;
      }

      if (!hasChapathi && !hasOutside) {
        contentHtml += `
          <div class="text-[10px] px-1 py-0.5 rounded text-slate-400 bg-slate-100 font-medium text-center">
            No dinner
          </div>
        `;
      }
    } else {
      contentHtml += `
        <div class="opacity-0 group-hover:opacity-100 text-[11px] text-slate-400 font-medium transition text-center py-1">
          + Add
        </div>
      `;
    }
    contentHtml += '</div>';

    // Daily total indicator at bottom
    let totalHtml = '';
    if (record) {
      const dayTotal = calculateDayTotal(record);
      if (dayTotal > 0) {
        totalHtml = `
          <div class="text-right text-[11px] font-extrabold text-slate-800 pt-1 border-t border-slate-100">
            Total: <span class="text-emerald-700">₹${dayTotal}</span>
          </div>
        `;
      }
    }

    cell.innerHTML = dayHeaderHtml + contentHtml + totalHtml;
    container.appendChild(cell);
  }

  // 3. Next month trailing padding cells to complete grid
  const totalCells = firstDayOfMonth + daysInMonth;
  const trailingCount = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= trailingCount; i++) {
    const cell = document.createElement('div');
    cell.className = 'min-h-[90px] sm:min-h-[115px] p-2 bg-slate-50/50 opacity-40 select-none';
    cell.innerHTML = `<span class="text-xs font-semibold text-slate-400">${i}</span>`;
    container.appendChild(cell);
  }

  safeCreateIcons();
}

// --------------------------------------------------------------------------
// QUICK LOG FOR TODAY BANNER
// --------------------------------------------------------------------------

function updateTodayBanner() {
  const todayIso = getTodayIso();
  const dateObj = new Date();
  
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('today-banner-date').textContent = dateObj.toLocaleDateString('en-IN', options);

  const statusLabel = document.getElementById('today-banner-status');
  const quickBtn = document.getElementById('quick-today-btn');
  const record = dinnerRecords[todayIso];

  if (record && (record.chapathis > 0 || (record.outsideFood && record.outsideCost > 0))) {
    const total = calculateDayTotal(record);
    let desc = [];
    if (record.chapathis > 0) desc.push(`${record.chapathis} Chapathis (₹${record.chapathis * settings.chapathiRate})`);
    if (record.outsideFood && record.outsideCost > 0) desc.push(`Outside: ${record.outsideDesc || 'Food'} (₹${record.outsideCost})`);

    statusLabel.innerHTML = `✅ <strong>Recorded:</strong> ${desc.join(' + ')} · <strong>Total: ₹${total}</strong>`;
    
    // Switch button to Edit / View
    quickBtn.innerHTML = `
      <span class="text-lg">✏️</span>
      <span>Edit Today's Record</span>
    `;
    quickBtn.onclick = () => openEntryModal(todayIso);
  } else {
    statusLabel.textContent = `Today's dinner not logged yet. Click below for quick 1-tap entry!`;
    const defaultCost = settings.defaultChapathiQty * settings.chapathiRate;
    quickBtn.innerHTML = `
      <span class="text-lg">⚡</span>
      <span>Add ${settings.defaultChapathiQty} Chapathis (₹${defaultCost})</span>
    `;
    quickBtn.onclick = quickLogDefaultToday;
  }
}

function quickLogDefaultToday() {
  const todayIso = getTodayIso();
  dinnerRecords[todayIso] = {
    chapathis: settings.defaultChapathiQty,
    outsideFood: false,
    outsideDesc: '',
    outsideCost: 0,
    notes: 'Quick logged standard 4 chapathis',
  };

  persistRecords();
  renderCalendar();
  updateTodayBanner();
  updateMonthStats();
  checkDinnerReminder();
  showToast(`Logged ${settings.defaultChapathiQty} Chapathis (₹${settings.defaultChapathiQty * settings.chapathiRate}) for Today!`, '🫓');
}

// --------------------------------------------------------------------------
// MONTH STATISTICS
// --------------------------------------------------------------------------

function updateMonthStats() {
  const prefix = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
  
  let totalChapathis = 0;
  let outsideDays = 0;
  let totalOutsideCost = 0;
  let activeDinnerDays = 0;

  for (const [dateIso, rec] of Object.entries(dinnerRecords)) {
    if (dateIso.startsWith(prefix)) {
      const hasChapathi = (rec.chapathis || 0) > 0;
      const hasOutside = rec.outsideFood && (rec.outsideCost || 0) > 0;

      if (hasChapathi || hasOutside) {
        activeDinnerDays++;
      }

      if (hasChapathi) {
        totalChapathis += rec.chapathis;
      }

      if (hasOutside) {
        outsideDays++;
        totalOutsideCost += Number(rec.outsideCost) || 0;
      }
    }
  }

  const chapathiCost = totalChapathis * settings.chapathiRate;
  const grandTotal = chapathiCost + totalOutsideCost;

  document.getElementById('stat-total-chapathis').textContent = totalChapathis;
  document.getElementById('stat-chapathi-cost').textContent = `₹${chapathiCost.toLocaleString('en-IN')}`;
  document.getElementById('stat-outside-days').textContent = outsideDays;
  document.getElementById('stat-outside-cost').textContent = `₹${totalOutsideCost.toLocaleString('en-IN')}`;
  document.getElementById('stat-active-days').textContent = activeDinnerDays;
  document.getElementById('stat-grand-total').textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
}

// --------------------------------------------------------------------------
// MODAL: DAILY ENTRY (ENHANCED & INTUITIVE FOR MOM)
// --------------------------------------------------------------------------

let currentModalDate = null;
let currentEntryMode = 'chapathi'; // 'chapathi' | 'outside' | 'both' | 'none'

function openEntryModal(dateIso, initialMode = null) {
  if (!dateIso || typeof dateIso !== 'string') {
    dateIso = getTodayIso();
  }
  currentModalDate = dateIso;

  const modal = document.getElementById('entry-modal');
  const datePicker = document.getElementById('entry-date-picker');
  datePicker.value = dateIso;

  updateModalDateHeading(dateIso);

  const deleteBtn = document.getElementById('modal-delete-btn');
  const record = dinnerRecords[dateIso];

  if (record) {
    deleteBtn.classList.remove('hidden');
    document.getElementById('entry-chapathis').value = record.chapathis ?? 0;
    document.getElementById('entry-outside-desc').value = record.outsideDesc || '';
    document.getElementById('entry-outside-cost').value = (record.outsideCost && record.outsideCost > 0) ? record.outsideCost : '';
    document.getElementById('entry-notes').value = record.notes || '';

    // Determine mode
    const hasChapathi = (record.chapathis || 0) > 0;
    const hasOutside = record.outsideFood && (record.outsideCost || 0) > 0;

    if (hasChapathi && hasOutside) {
      setEntryMode('both');
    } else if (hasOutside) {
      setEntryMode('outside');
    } else if (hasChapathi) {
      setEntryMode('chapathi');
    } else {
      setEntryMode('none');
    }
  } else {
    deleteBtn.classList.add('hidden');
    document.getElementById('entry-notes').value = '';
    document.getElementById('entry-outside-desc').value = '';
    document.getElementById('entry-outside-cost').value = '';

    if (initialMode === 'outside') {
      document.getElementById('entry-chapathis').value = 0;
      setEntryMode('outside');
      setTimeout(() => {
        document.getElementById('entry-outside-desc').focus();
      }, 100);
    } else if (initialMode === 'both') {
      document.getElementById('entry-chapathis').value = settings.defaultChapathiQty;
      setEntryMode('both');
    } else {
      // Default to Chapathis mode
      document.getElementById('entry-chapathis').value = settings.defaultChapathiQty;
      setEntryMode('chapathi');
    }
  }

  updateModalCalculation();
  modal.classList.remove('hidden');
  safeCreateIcons();
}

function updateModalDateHeading(dateIso) {
  try {
    const [year, month, day] = dateIso.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const formatted = dateObj.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    document.getElementById('modal-date-display').textContent = formatted;
  } catch (e) {
    document.getElementById('modal-date-display').textContent = dateIso;
  }
}

function onModalDateChanged(newDateIso) {
  if (!newDateIso) return;
  openEntryModal(newDateIso);
}

function setModalDateToToday() {
  const today = getTodayIso();
  document.getElementById('entry-date-picker').value = today;
  onModalDateChanged(today);
}

function setModalDateToYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = formatDateIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  document.getElementById('entry-date-picker').value = yesterday;
  onModalDateChanged(yesterday);
}

function setEntryMode(mode) {
  currentEntryMode = mode;
  const modes = ['chapathi', 'outside', 'both', 'none'];

  modes.forEach(m => {
    const btn = document.getElementById(`mode-btn-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'py-2.5 px-2 rounded-xl transition bg-white text-brand-700 shadow-md font-extrabold ring-1 ring-slate-200';
      } else {
        btn.className = 'py-2.5 px-2 rounded-xl transition text-slate-600 hover:text-slate-900 font-semibold';
      }
    }
  });

  const chapathiContainer = document.getElementById('section-chapathi-container');
  const outsideContainer = document.getElementById('section-outside-container');

  if (mode === 'chapathi') {
    chapathiContainer.classList.remove('hidden');
    outsideContainer.classList.add('hidden');
    if (parseInt(document.getElementById('entry-chapathis').value) === 0) {
      document.getElementById('entry-chapathis').value = settings.defaultChapathiQty;
    }
  } else if (mode === 'outside') {
    chapathiContainer.classList.add('hidden');
    outsideContainer.classList.remove('hidden');
    document.getElementById('entry-chapathis').value = 0;
  } else if (mode === 'both') {
    chapathiContainer.classList.remove('hidden');
    outsideContainer.classList.remove('hidden');
    if (parseInt(document.getElementById('entry-chapathis').value) === 0) {
      document.getElementById('entry-chapathis').value = settings.defaultChapathiQty;
    }
  } else if (mode === 'none') {
    chapathiContainer.classList.add('hidden');
    outsideContainer.classList.add('hidden');
    document.getElementById('entry-chapathis').value = 0;
  }

  updateModalCalculation();
}

function quickFillOutsideFood(foodName) {
  const descInput = document.getElementById('entry-outside-desc');
  descInput.value = foodName;
  const costInput = document.getElementById('entry-outside-cost');
  costInput.focus();
}

function closeEntryModal() {
  document.getElementById('entry-modal').classList.add('hidden');
  currentModalDate = null;
}

function setChapathis(val) {
  document.getElementById('entry-chapathis').value = val;
  updateModalCalculation();
}

function adjustChapathi(delta) {
  const input = document.getElementById('entry-chapathis');
  let current = parseInt(input.value) || 0;
  current = Math.max(0, current + delta);
  input.value = current;
  updateModalCalculation();
}

function updateModalCalculation() {
  let chapathis = 0;
  let outsideCost = 0;

  if (currentEntryMode === 'chapathi' || currentEntryMode === 'both') {
    chapathis = parseInt(document.getElementById('entry-chapathis').value) || 0;
  }

  if (currentEntryMode === 'outside' || currentEntryMode === 'both') {
    outsideCost = parseFloat(document.getElementById('entry-outside-cost').value) || 0;
  }

  const chapathiTotal = chapathis * settings.chapathiRate;
  document.getElementById('modal-chapathi-calc').textContent = `₹${chapathiTotal}`;

  const grandTotal = chapathiTotal + outsideCost;
  document.getElementById('modal-grand-day-total').textContent = `₹${grandTotal}`;
}

function saveEntry(e) {
  if (e && e.preventDefault) e.preventDefault();

  const datePicker = document.getElementById('entry-date-picker');
  const dateIso = datePicker ? datePicker.value : currentModalDate;
  if (!dateIso) {
    showToast('Please select a valid date', '⚠️');
    return;
  }

  let chapathis = 0;
  let isOutside = false;
  let outsideDesc = '';
  let outsideCost = 0;

  if (currentEntryMode === 'chapathi') {
    chapathis = Math.max(0, parseInt(document.getElementById('entry-chapathis').value) || 0);
  } else if (currentEntryMode === 'outside') {
    isOutside = true;
    outsideDesc = document.getElementById('entry-outside-desc').value.trim() || 'Outside Food';
    outsideCost = Math.max(0, parseFloat(document.getElementById('entry-outside-cost').value) || 0);
  } else if (currentEntryMode === 'both') {
    chapathis = Math.max(0, parseInt(document.getElementById('entry-chapathis').value) || 0);
    isOutside = true;
    outsideDesc = document.getElementById('entry-outside-desc').value.trim() || 'Outside Food';
    outsideCost = Math.max(0, parseFloat(document.getElementById('entry-outside-cost').value) || 0);
  } else if (currentEntryMode === 'none') {
    chapathis = 0;
    isOutside = false;
  }

  const notes = document.getElementById('entry-notes').value.trim();

  // Save record
  dinnerRecords[dateIso] = {
    chapathis,
    outsideFood: isOutside,
    outsideDesc: isOutside ? outsideDesc : '',
    outsideCost: outsideCost,
    notes,
  };

  persistRecords();
  closeEntryModal();
  renderCalendar();
  updateTodayBanner();
  updateMonthStats();
  checkDinnerReminder();
  if (!document.getElementById('view-bill').classList.contains('hidden')) {
    renderBill();
  }
  showToast(`Saved dinner record for ${dateIso}`, '✅');
}

function deleteCurrentEntry() {
  const datePicker = document.getElementById('entry-date-picker');
  const dateIso = datePicker ? datePicker.value : currentModalDate;
  if (!dateIso) return;

  if (confirm(`Remove dinner record for ${dateIso}?`)) {
    delete dinnerRecords[dateIso];
    persistRecords();
    closeEntryModal();
    renderCalendar();
    updateTodayBanner();
    updateMonthStats();
    checkDinnerReminder();
    if (!document.getElementById('view-bill').classList.contains('hidden')) {
      renderBill();
    }
    showToast('Record deleted', '🗑️');
  }
}

// --------------------------------------------------------------------------
// VIEW SWITCHING (CALENDAR VS BILL)
// --------------------------------------------------------------------------

function switchView(viewName) {
  const calView = document.getElementById('view-calendar');
  const billView = document.getElementById('view-bill');
  const calTab = document.getElementById('tab-calendar-btn');
  const billTab = document.getElementById('tab-bill-btn');

  if (viewName === 'calendar') {
    calView.classList.remove('hidden');
    billView.classList.add('hidden');

    calTab.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-800 shadow-sm transition';
    billTab.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition';
    renderCalendar();
  } else {
    calView.classList.add('hidden');
    billView.classList.remove('hidden');

    billTab.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-800 shadow-sm transition';
    calTab.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition';
    renderBill();
  }
  safeCreateIcons();
}

// --------------------------------------------------------------------------
// MONTHLY BILL & INVOICE GENERATOR
// --------------------------------------------------------------------------

function initBillViewMonth() {
  const picker = document.getElementById('bill-month-picker');
  const monthVal = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
  picker.value = monthVal;
}

function onBillMonthChange() {
  const picker = document.getElementById('bill-month-picker');
  if (picker.value) {
    const [year, month] = picker.value.split('-').map(Number);
    currentViewYear = year;
    currentViewMonth = month - 1;
    renderBill();
  }
}

function renderBill() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthLabel = `${monthNames[currentViewMonth]} ${currentViewYear}`;
  document.getElementById('bill-month-display').textContent = monthLabel;

  const now = new Date();
  document.getElementById('bill-generated-date').textContent = `Generated: ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const prefix = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();

  const tbody = document.getElementById('bill-table-body');
  tbody.innerHTML = '';

  let totalChapathis = 0;
  let totalOutsideCost = 0;
  let activeDays = 0;

  // Scan all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = formatDateIso(currentViewYear, currentViewMonth + 1, day);
    const rec = dinnerRecords[dateIso];

    if (!rec) continue;

    const hasChapathi = (rec.chapathis || 0) > 0;
    const hasOutside = rec.outsideFood && (rec.outsideCost || 0) > 0;

    if (!hasChapathi && !hasOutside) continue;

    activeDays++;
    const [y, m, d] = dateIso.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

    let particulars = [];
    if (hasChapathi) {
      particulars.push(`Home Cooked Chapathis (${rec.chapathis} pcs)`);
    }
    if (hasOutside) {
      particulars.push(`Outside Food: ${rec.outsideDesc || 'Hotel Order'}`);
    }
    if (rec.notes) {
      particulars.push(`<em>(${rec.notes})</em>`);
    }

    const chapathiCost = (rec.chapathis || 0) * settings.chapathiRate;
    const outsideCost = hasOutside ? Number(rec.outsideCost) : 0;
    const dayTotal = chapathiCost + outsideCost;

    totalChapathis += (rec.chapathis || 0);
    totalOutsideCost += outsideCost;

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-50/80 transition';
    row.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-slate-800">${String(day).padStart(2, '0')}/${String(currentViewMonth + 1).padStart(2, '0')}</td>
      <td class="py-2.5 px-3 text-slate-500 font-medium text-xs">${dayName}</td>
      <td class="py-2.5 px-3 text-slate-800">${particulars.join(' + ')}</td>
      <td class="py-2.5 px-3 text-center font-bold text-amber-800">${hasChapathi ? rec.chapathis : '-'}</td>
      <td class="py-2.5 px-3 text-right font-semibold text-purple-800">${hasOutside ? `₹${outsideCost}` : '-'}</td>
      <td class="py-2.5 px-3 text-right font-bold text-slate-900">₹${dayTotal}</td>
    `;
    tbody.appendChild(row);
  }

  if (activeDays === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="6" class="text-center py-8 text-slate-400 italic">
        No dinner records logged for ${monthLabel}.<br>
        <span class="text-xs">Switch to "Daily Log" tab to add records.</span>
      </td>
    `;
    tbody.appendChild(emptyRow);
  }

  const subtotalChapathis = totalChapathis * settings.chapathiRate;
  const grandTotal = subtotalChapathis + totalOutsideCost;

  document.getElementById('bill-subtotal-chapathis').textContent = `₹${subtotalChapathis.toLocaleString('en-IN')}`;
  document.getElementById('bill-subtotal-outside').textContent = `₹${totalOutsideCost.toLocaleString('en-IN')}`;
  document.getElementById('bill-grand-total').textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
  document.getElementById('bill-total-days-count').textContent = `${activeDays} days`;
  document.getElementById('bill-amount-words').textContent = numberToIndianWords(grandTotal);
}

// --------------------------------------------------------------------------
// WHATSAPP BILL SHARE & CSV EXPORT
// --------------------------------------------------------------------------

function copyBillWhatsApp() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[currentViewMonth]} ${currentViewYear}`;
  const prefix = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();

  let totalChapathis = 0;
  let totalOutsideCost = 0;
  let activeDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = formatDateIso(currentViewYear, currentViewMonth + 1, day);
    const rec = dinnerRecords[dateIso];
    if (rec) {
      if ((rec.chapathis || 0) > 0) totalChapathis += rec.chapathis;
      if (rec.outsideFood && (rec.outsideCost || 0) > 0) totalOutsideCost += Number(rec.outsideCost);
      if ((rec.chapathis || 0) > 0 || (rec.outsideFood && (rec.outsideCost || 0) > 0)) activeDays++;
    }
  }

  const chapathiCost = totalChapathis * settings.chapathiRate;
  const grandTotal = chapathiCost + totalOutsideCost;

  const msg = `*DINNER BILL STATEMENT - ${monthLabel.toUpperCase()}* 🧾
To: *${settings.recipientName || settings.priestName || 'Recipient'}*
From: *${settings.momName || 'Mother'}*
---------------------------------------
🗓️ Total Dinner Days: *${activeDays} days*
🫓 Total Chapathis: *${totalChapathis} nos* (₹${settings.chapathiRate}/each) = *₹${chapathiCost}*
🥡 Outside Food: *₹${totalOutsideCost}*
---------------------------------------
💰 *GRAND TOTAL AMOUNT: ₹${grandTotal}*
(${numberToIndianWords(grandTotal)})
---------------------------------------
_Prepared with care by ${settings.momName || 'Mother'}_`;

  navigator.clipboard.writeText(msg).then(() => {
    showToast('WhatsApp bill summary copied to clipboard!', '📋');
  }).catch(() => {
    // Fallback prompt
    window.prompt('Copy bill text below:', msg);
  });
}

function exportMonthCsv() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[currentViewMonth]}_${currentViewYear}`;
  const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();

  let csvContent = 'Date,Day,Dinner Particulars,Chapathis Count,Chapathi Rate,Chapathi Cost,Outside Food Details,Outside Food Amount,Day Total,Notes\n';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = formatDateIso(currentViewYear, currentViewMonth + 1, day);
    const rec = dinnerRecords[dateIso];
    if (!rec) continue;

    const hasChapathi = (rec.chapathis || 0) > 0;
    const hasOutside = rec.outsideFood && (rec.outsideCost || 0) > 0;
    if (!hasChapathi && !hasOutside) continue;

    const [y, m, d] = dateIso.split('-').map(Number);
    const dayName = new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' });
    const cCount = rec.chapathis || 0;
    const cCost = cCount * settings.chapathiRate;
    const oCost = hasOutside ? rec.outsideCost : 0;
    const oDesc = (rec.outsideDesc || '').replace(/"/g, '""');
    const dayTotal = cCost + oCost;
    const notes = (rec.notes || '').replace(/"/g, '""');

    csvContent += `"${dateIso}","${dayName}","${cCount > 0 ? cCount + ' Chapathis' : ''} ${hasOutside ? '+ Outside' : ''}",${cCount},${settings.chapathiRate},${cCost},"${oDesc}",${oCost},${dayTotal},"${notes}"\n`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Dinner_Bill_${monthLabel}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Downloaded CSV file', '📥');
}

// --------------------------------------------------------------------------
// SETTINGS MODAL & BACKUP DATA
// --------------------------------------------------------------------------

function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function exportDataBackup() {
  const data = {
    settings,
    dinnerRecords,
    exportedAt: new Date().toISOString()
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `dinner_tracker_backup_${getTodayIso()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Backup exported successfully', '💾');
}

function importDataBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.dinnerRecords) {
        dinnerRecords = parsed.dinnerRecords;
        persistRecords();
      }
      if (parsed.settings) {
        settings = { ...settings, ...parsed.settings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        syncSettingsUI();
      }
      renderCalendar();
      updateTodayBanner();
      updateMonthStats();
      showToast('Data restored successfully!', '✅');
      closeSettingsModal();
    } catch (err) {
      alert('Invalid backup file format');
    }
  };
  reader.readAsText(file);
}

function loadSampleDataDemo() {
  if (!confirm('Load sample demonstration records for this month? (This will add a few example entries)')) {
    return;
  }

  const year = currentViewYear;
  const month = currentViewMonth + 1;

  // Add 10 sample days
  dinnerRecords[formatDateIso(year, month, 1)] = { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' };
  dinnerRecords[formatDateIso(year, month, 2)] = { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' };
  dinnerRecords[formatDateIso(year, month, 3)] = { chapathis: 0, outsideFood: true, outsideDesc: '3 Parottas with Kurma', outsideCost: 110, notes: 'Bought from hotel' };
  dinnerRecords[formatDateIso(year, month, 4)] = { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' };
  dinnerRecords[formatDateIso(year, month, 5)] = { chapathis: 5, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: 'Requested 1 extra chapathi' };
  dinnerRecords[formatDateIso(year, month, 7)] = { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' };
  dinnerRecords[formatDateIso(year, month, 8)] = { chapathis: 0, outsideFood: true, outsideDesc: 'Idli & Vada parcel', outsideCost: 75, notes: '' };
  dinnerRecords[formatDateIso(year, month, 9)] = { chapathis: 4, outsideFood: false, outsideDesc: '', outsideCost: 0, notes: '' };

  persistRecords();
  closeSettingsModal();
  renderCalendar();
  updateTodayBanner();
  updateMonthStats();
  if (!document.getElementById('view-bill').classList.contains('hidden')) {
    renderBill();
  }
  showToast('Demo records loaded!', '✨');
}

// --------------------------------------------------------------------------
// HELPER UTILITIES
// --------------------------------------------------------------------------

function getTodayIso() {
  const d = new Date();
  return formatDateIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function formatDateIso(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calculateDayTotal(rec) {
  if (!rec) return 0;
  const cCost = (rec.chapathis || 0) * settings.chapathiRate;
  const oCost = rec.outsideFood ? (Number(rec.outsideCost) || 0) : 0;
  return cCost + oCost;
}

function showToast(message, icon = '✅') {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;
  document.getElementById('toast-icon').textContent = icon;

  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
  }, 2800);
}

// Convert Number to Words (Indian Currency format)
function numberToIndianWords(num) {
  if (!num || num === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertLessThanOneThousand(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + (n % 10 !== 0 ? ones[n % 10] + ' ' : '');
    return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? convertLessThanOneThousand(n % 100) : '');
  }

  let words = '';
  let crore = Math.floor(num / 10000000);
  num %= 10000000;
  let lakh = Math.floor(num / 100000);
  num %= 100000;
  let thousand = Math.floor(num / 1000);
  num %= 1000;
  let remaining = num;

  if (crore > 0) words += convertLessThanOneThousand(crore) + 'Crore ';
  if (lakh > 0) words += convertLessThanOneThousand(lakh) + 'Lakh ';
  if (thousand > 0) words += convertLessThanOneThousand(thousand) + 'Thousand ';
  if (remaining > 0) words += convertLessThanOneThousand(remaining);

  return 'Rupees ' + words.trim() + ' Only';
}

// --------------------------------------------------------------------------
// 9:00 PM REMINDER NOTIFICATION SYSTEM
// --------------------------------------------------------------------------

function initReminderSystem() {
  // Check if browser notification is already permitted or needs prompt
  updateNotificationPromptUI();

  // Run immediate check
  checkDinnerReminder();

  // Run periodic check every 30 seconds
  if (reminderIntervalTimer) clearInterval(reminderIntervalTimer);
  reminderIntervalTimer = setInterval(checkDinnerReminder, 30000);
}

function updateNotificationPromptUI() {
  const banner = document.getElementById('notification-prompt-banner');
  if (!banner) return;

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } else {
    banner.classList.add('hidden');
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('This browser does not support desktop notifications, but in-app reminders and sounds will still work!');
    return;
  }

  Notification.requestPermission().then((permission) => {
    updateNotificationPromptUI();
    if (permission === 'granted') {
      showToast('Notifications enabled! You will be reminded at 9:00 PM.', '🔔');
      playReminderChime();
    } else {
      showToast('Notification permission was not granted.', '⚠️');
    }
  });
}

function dismissNotificationPrompt() {
  const banner = document.getElementById('notification-prompt-banner');
  if (banner) banner.classList.add('hidden');
}

function hasDinnerForToday() {
  const todayIso = getTodayIso();
  const rec = dinnerRecords[todayIso];
  if (!rec) return false;
  return (rec.chapathis > 0) || (rec.outsideFood && rec.outsideCost > 0);
}

function checkDinnerReminder() {
  if (!settings.reminderEnabled) {
    const alertBox = document.getElementById('night-reminder-alert');
    if (alertBox) alertBox.classList.add('hidden');
    return;
  }

  const todayIso = getTodayIso();
  const entered = hasDinnerForToday();
  const alertBox = document.getElementById('night-reminder-alert');

  // Parse reminder time (default 21:00 = 9:00 PM)
  const [targetH, targetM] = (settings.reminderTime || '21:00').split(':').map(Number);
  const now = new Date();
  const currentH = now.getHours();
  const currentM = now.getMinutes();

  const isPastReminderTime = (currentH > targetH) || (currentH === targetH && currentM >= targetM);

  if (isPastReminderTime && !entered) {
    // Show in-app reminder alert banner
    if (alertBox) alertBox.classList.remove('hidden');

    // Check if system notification was already dispatched today
    const lastSentDate = localStorage.getItem(LAST_REMINDER_KEY);
    if (lastSentDate !== todayIso) {
      triggerDinnerReminder(false);
      localStorage.setItem(LAST_REMINDER_KEY, todayIso);
    }
  } else {
    // Hide in-app reminder alert if entered or before reminder time
    if (alertBox) alertBox.classList.add('hidden');
  }
}

function triggerDinnerReminder(isManualTest = false) {
  // 1. Play gentle audio chime
  playReminderChime();

  // 2. Show native browser notification if granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const title = isManualTest ? '🔔 Test: Dinner Log Reminder (9:00 PM)' : '⏰ Dinner Reminder (9:00 PM)';
      const body = isManualTest 
        ? "Reminder works perfectly! At 9:00 PM you'll get this reminder if today's dinner is not entered." 
        : "Today's dinner has not been entered yet today! Tap here to log 4 Chapathis or Outside Food.";

      const notif = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🫓</text></svg>',
        tag: 'dinner-reminder',
        requireInteraction: true,
      });

      notif.onclick = () => {
        window.focus();
        openEntryModal(getTodayIso());
        notif.close();
      };
    } catch (e) {
      console.warn('System notification error:', e);
    }
  }

  if (isManualTest) {
    showToast('Test reminder sound & alert triggered!', '🔔');
  }
}

// Gentle pleasant double chime using Web Audio API
function playReminderChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Note 1: 523.25 Hz (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Note 2: 659.25 Hz (E5) after 150ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.warn('Audio chime could not play:', e);
  }
}

function testNotificationNow() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then((permission) => {
      updateNotificationPromptUI();
      triggerDinnerReminder(true);
    });
  } else {
    triggerDinnerReminder(true);
  }
}

// ==========================================================================
// TAMIL VOICE ASSISTANT ENGINE (FOR MOM)
// ==========================================================================

let recognitionInstance = null;
let isListening = false;

function startTamilVoiceRecognition(isInsideModal = false) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('மன்னிக்கவும், உங்கள் உலாவியில் குரல் அறிதல் வசதி இல்லை. தயவுசெய்து Google Chrome அல்லது Microsoft Edge பயன்படுத்தவும்.\n(Sorry, Web Speech is not supported in this browser. Please use Chrome or Edge.)');
    return;
  }

  if (isListening && recognitionInstance) {
    try { recognitionInstance.stop(); } catch (e) {}
    return;
  }

  try {
    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'ta-IN'; // Tamil (India)
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.maxAlternatives = 1;

    setVoiceUIListeningState(true);

    recognitionInstance.onstart = () => {
      isListening = true;
      setVoiceUIListeningState(true);
      showToast('🎙️ கேட்கிறது... பேசுங்கள் (Listening in Tamil...)', '🎙️');
    };

    recognitionInstance.onend = () => {
      isListening = false;
      setVoiceUIListeningState(false);
    };

    recognitionInstance.onerror = (event) => {
      isListening = false;
      setVoiceUIListeningState(false);
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('மைக்ரோஃபோன் அனுமதி தேவை (Microphone permission needed). தயவுசெய்து Browser-ல் Mic அனுமதியை இயக்கவும்.');
      } else if (event.error === 'no-speech') {
        showToast('குரல் கேட்கவில்லை, மீண்டும் முயற்சிக்கவும்', '⚠️');
      } else {
        showToast('குரல் பதிவில் பிழை: ' + event.error, '⚠️');
      }
    };

    recognitionInstance.onresult = (event) => {
      isListening = false;
      setVoiceUIListeningState(false);

      if (event.results && event.results.length > 0) {
        const transcript = event.results[0][0].transcript.trim();
        console.log('Tamil Voice Transcript:', transcript);
        processTamilVoiceCommand(transcript, isInsideModal);
      }
    };

    recognitionInstance.start();
  } catch (err) {
    isListening = false;
    setVoiceUIListeningState(false);
    console.error('Failed to start speech recognition:', err);
    showToast('குரல் வசதியை தொடங்குவதில் சிக்கல்', '❌');
  }
}

function setVoiceUIListeningState(active) {
  const btn = document.getElementById('start-voice-btn');
  const label = document.getElementById('voice-btn-label');
  const indicator = document.getElementById('voice-mic-indicator');
  const micWrapper = document.getElementById('voice-mic-icon-wrapper');
  const statusText = document.getElementById('voice-status-text');

  if (active) {
    if (btn) {
      btn.className = 'w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/30 transition text-sm sm:text-base animate-pulse ring-4 ring-rose-300';
    }
    if (label) label.textContent = 'கேட்கிறது... பேசுங்கள்!';
    if (indicator) indicator.textContent = '🔴';
    if (micWrapper) micWrapper.classList.add('scale-110', 'bg-rose-100', 'text-rose-700');
    if (statusText) statusText.textContent = 'மைக் ஆன் செய்யப்பட்டுள்ளது... தமிழில் பேசுங்கள்!';
  } else {
    if (btn) {
      btn.className = 'w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 active:scale-95 font-bold shadow-md transition text-sm sm:text-base';
    }
    if (label) label.textContent = 'தமிழில் பேசுங்கள்';
    if (indicator) indicator.textContent = '🎙️';
    if (micWrapper) micWrapper.classList.remove('scale-110', 'bg-rose-100', 'text-rose-700');
  }
}

// --------------------------------------------------------------------------
// TAMIL SPEECH PARSER
// --------------------------------------------------------------------------

function processTamilVoiceCommand(rawTranscript, isInsideModal) {
  const t = rawTranscript.toLowerCase();
  showToast(`🎙️ "${rawTranscript}"`, '🗣️');

  // 1. Determine Target Date
  let targetDate = getTodayIso();
  let dateDesc = 'இன்றைக்கு';

  if (t.includes('நேத்து') || t.includes('நேற்று') || t.includes('yesterday')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = formatDateIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
    dateDesc = 'நேற்றைக்கு';
  }

  // 2. Extract Numbers (digits and Tamil spoken words)
  const extractedNumbers = extractNumbersFromTamilText(t);

  // 3. Check for "No Dinner / Fasting"
  const isNoDinner = (
    t.includes('இல்ல') ||
    t.includes('இல்லை') ||
    t.includes('சாப்பிடல') ||
    t.includes('சாப்பிடவில்லை') ||
    t.includes('வேண்டாம்') ||
    t.includes('நோன்பு') ||
    t.includes('fasting')
  );

  // 4. Check for Chapathis
  const isChapathi = (
    t.includes('சப்பாத்தி') ||
    t.includes('சபாதி') ||
    t.includes('chapathi') ||
    t.includes('chappathi') ||
    t.includes('roti')
  );

  // 5. Check for Outside Food
  const isOutside = (
    t.includes('பரோட்டா') ||
    t.includes('சாப்பாடு') ||
    t.includes('மீல்ஸ்') ||
    t.includes('meals') ||
    t.includes('இட்லி') ||
    t.includes('தோசை') ||
    t.includes('பிரியாணி') ||
    t.includes('ஹோட்டல்') ||
    t.includes('கடையில') ||
    t.includes('வெளியில') ||
    t.includes('ரூபாய்') ||
    t.includes('ரூபா') ||
    t.includes('ரூ') ||
    t.includes('rs') ||
    t.includes('rupees')
  );

  let successMsg = '';
  let speechReply = '';

  if (isNoDinner && !isChapathi && !isOutside) {
    // Recorded No Dinner
    dinnerRecords[targetDate] = {
      chapathis: 0,
      outsideFood: false,
      outsideDesc: '',
      outsideCost: 0,
      notes: 'குரல் வழி பதிவு: சாப்பாடு இல்லை',
    };
    successMsg = `${dateDesc} சாப்பாடு இல்லை என்று குறிக்கப்பட்டது`;
    speechReply = `${dateDesc} சாப்பாடு இல்லை என்று பதிவு செய்யப்பட்டது`;
  } else if (isChapathi && !isOutside) {
    // Chapathis only
    let qty = settings.defaultChapathiQty; // default 4
    if (extractedNumbers.length > 0) {
      qty = extractedNumbers[0];
    }
    const cost = qty * settings.chapathiRate;

    dinnerRecords[targetDate] = {
      chapathis: qty,
      outsideFood: false,
      outsideDesc: '',
      outsideCost: 0,
      notes: `குரல் வழி பதிவு: ${rawTranscript}`,
    };
    successMsg = `${dateDesc} ${qty} சப்பாத்தி (₹${cost}) பதிவு செய்யப்பட்டது!`;
    speechReply = `${dateDesc} ${qty} சப்பாத்தி பதிவு செய்யப்பட்டது. மொத்தம் ${cost} ரூபாய்.`;
  } else if (isOutside && !isChapathi) {
    // Outside Food only
    let foodName = 'ஹோட்டல் உணவு (Outside Food)';
    if (t.includes('பரோட்டா') || t.includes('parotta')) foodName = 'பரோட்டா (Parotta)';
    else if (t.includes('மீல்ஸ்') || t.includes('சாப்பாடு') || t.includes('meals')) foodName = 'ஹோட்டல் சாப்பாடு (Meals)';
    else if (t.includes('இட்லி') || t.includes('idli')) foodName = 'இட்லி (Idli)';
    else if (t.includes('தோசை') || t.includes('dosa')) foodName = 'தோசை (Dosa)';
    else if (t.includes('பிரியாணி') || t.includes('biryani')) foodName = 'பிரியாணி (Biryani)';

    // Amount
    let cost = 0;
    if (extractedNumbers.length > 0) {
      // Pick the largest number or number before ரூபாய்
      cost = extractedNumbers[extractedNumbers.length - 1];
    }

    dinnerRecords[targetDate] = {
      chapathis: 0,
      outsideFood: true,
      outsideDesc: foodName,
      outsideCost: cost,
      notes: `குரல் வழி பதிவு: ${rawTranscript}`,
    };
    successMsg = `${dateDesc} ${foodName} - ₹${cost} பதிவு செய்யப்பட்டது!`;
    speechReply = `${dateDesc} ${foodName} ${cost} ரூபாய் பதிவு செய்யப்பட்டது.`;
  } else if (isChapathi && isOutside) {
    // Both
    let qty = 4;
    let cost = 0;
    if (extractedNumbers.length >= 2) {
      qty = extractedNumbers[0];
      cost = extractedNumbers[1];
    } else if (extractedNumbers.length === 1) {
      if (extractedNumbers[0] <= 10) qty = extractedNumbers[0];
      else cost = extractedNumbers[0];
    }

    let foodName = 'ஹோட்டல் உணவு';
    if (t.includes('பரோட்டா')) foodName = 'பரோட்டா';
    else if (t.includes('சாப்பாடு')) foodName = 'ஹோட்டல் சாப்பாடு';
    else if (t.includes('இட்லி')) foodName = 'இட்லி';

    dinnerRecords[targetDate] = {
      chapathis: qty,
      outsideFood: true,
      outsideDesc: foodName,
      outsideCost: cost,
      notes: `குரல் வழி பதிவு: ${rawTranscript}`,
    };
    const total = (qty * settings.chapathiRate) + cost;
    successMsg = `${dateDesc} ${qty} சப்பாத்தி + ${foodName} (மொத்தம் ₹${total}) பதிவு செய்யப்பட்டது!`;
    speechReply = `${dateDesc} ${qty} சப்பாத்தி மற்றும் ${foodName} பதிவு செய்யப்பட்டது. மொத்தம் ${total} ரூபாய்.`;
  } else {
    // Default fallback: if any number heard, assume chapathis; otherwise standard 4 chapathis
    let qty = 4;
    if (extractedNumbers.length > 0 && extractedNumbers[0] <= 10) {
      qty = extractedNumbers[0];
    }
    const cost = qty * settings.chapathiRate;
    dinnerRecords[targetDate] = {
      chapathis: qty,
      outsideFood: false,
      outsideDesc: '',
      outsideCost: 0,
      notes: `குரல் வழி பதிவு: ${rawTranscript}`,
    };
    successMsg = `${dateDesc} ${qty} சப்பாத்தி (₹${cost}) பதிவு செய்யப்பட்டது!`;
    speechReply = `${dateDesc} ${qty} சப்பாத்தி பதிவு செய்யப்பட்டது.`;
  }

  // Persist & Update UI
  persistRecords();
  renderCalendar();
  updateTodayBanner();
  updateMonthStats();
  checkDinnerReminder();
  playReminderChime();

  if (!document.getElementById('view-bill').classList.contains('hidden')) {
    renderBill();
  }

  // Update status card label
  const statusText = document.getElementById('voice-status-text');
  if (statusText) {
    statusText.innerHTML = `✅ <strong>கேட்டது:</strong> "${rawTranscript}" → <span class="text-white font-bold">${successMsg}</span>`;
  }

  // If inside modal, sync modal
  if (!document.getElementById('entry-modal').classList.contains('hidden')) {
    openEntryModal(targetDate);
  }

  // Speak Tamil voice confirmation to mom!
  speakTamilReply(speechReply);
  showToast(successMsg, '✅');
}

// Extract numbers from text (supports Arabic digits & Tamil number words)
function extractNumbersFromTamilText(text) {
  const nums = [];

  // 1. Direct digits (e.g. 4, 120, 150)
  const digitMatches = text.match(/\d+/g);
  if (digitMatches) {
    digitMatches.forEach(d => nums.push(parseInt(d, 10)));
  }

  // 2. Tamil numeral words mapping
  const wordMap = {
    'ஒன்று': 1, 'ஒன்னு': 1, 'ஒரு': 1, 'one': 1,
    'இரண்டு': 2, 'ரெண்டு': 2, 'two': 2,
    'மூன்று': 3, 'மூணு': 3, 'three': 3,
    'நான்கு': 4, 'நாலு': 4, 'four': 4,
    'ஐந்து': 5, 'அஞ்சு': 5, 'five': 5,
    'ஆறு': 6, 'six': 6,
    'ஏழு': 7, 'seven': 7,
    'எட்டு': 8, 'eight': 8,
    'ஒன்பது': 9, 'nine': 9,
    'பத்து': 10, 'ten': 10,
    'இருபது': 20, 'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50,
    'அறுபது': 60, 'எழுபது': 70, 'எண்பது': 80, 'தொண்ணூறு': 90,
    'நூறு': 100, 'நூத்தி இருபது': 120, 'நூற்றிருபது': 120, 'நூத்தி ஐம்பது': 150,
    'இருநூறு': 200, 'முன்னூறு': 300
  };

  for (const [w, val] of Object.entries(wordMap)) {
    if (text.includes(w) && !nums.includes(val)) {
      nums.push(val);
    }
  }

  return nums;
}

// Speak Tamil Text to Speech back to Mom
function speakTamilReply(text) {
  if (!('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ta-IN';
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;

    // Try finding a Tamil voice
    const voices = window.speechSynthesis.getVoices();
    const tamilVoice = voices.find(v => v.lang.includes('ta') || v.lang.includes('ta-IN'));
    if (tamilVoice) {
      utterance.voice = tamilVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

