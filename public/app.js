// ==========================================================================
// FRONTEND CONTROLLER - PHYSIOTHERAPY APPOINTMENT SYSTEM
// ==========================================================================

// Application State
const state = {
  user: null,
  physiotherapists: [],
  selectedPhysio: null,
  selectedDate: '',
  selectedSlot: '',
  activeSlots: [],
  daysOff: [],
  emails: [],
  activeEmailId: null
};

// Safe JSON parse for User Session
try {
  state.user = JSON.parse(localStorage.getItem('physio_session') || 'null');
} catch (e) {
  localStorage.removeItem('physio_session');
}

// API Base URLs
const API_AUTH = '/api/auth';
const API_PHYSIO = '/api/physiotherapists';
const API_APPTS = '/api/appointments';
const API_DEV = '/api/dev';

// Page Views mapping
const VIEWS = {
  landing: document.getElementById('landing-view'),
  auth: document.getElementById('auth-view'),
  patient: document.getElementById('patient-dashboard-view'),
  physio: document.getElementById('physio-dashboard-view')
};

// -------------------------------------------------------------
// INITIALIZATION & ROUTING
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
  initAuthFormToggles();
  initAuthForms();
  initNavEvents();
  initBookingModalEvents();
  initPhysioScheduleEvents();
  initPaymentEvents();
  initSimulatorEvents();
  
  // Auto-open calendar date picker when clicking anywhere on a date input
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('click', function() {
      try {
        if (typeof this.showPicker === 'function') {
          this.showPicker();
        }
      } catch (e) {}
    });
  });

  // Setup periodic polling for emails and live dashboard updates (every 3 seconds)
  pollEmails();
  setInterval(() => {
    pollEmails();
    // Live update the physiotherapist dashboard if active
    if (window.location.hash === '#physio-dashboard' && state.user && state.user.role === 'physiotherapist') {
      fetchPhysioTimeline();
    }
  }, 3000);
});

// Simple Hash Router
function initRouter() {
  const handleRoute = () => {
    let hash = window.location.hash.slice(1) || 'landing';
    
    // Check if verification token in hash query parameter
    if (hash.includes('login?verifyToken=')) {
      const parts = hash.split('?verifyToken=');
      hash = 'login';
      const token = parts[1];
      if (token) {
        verifyEmailToken(token);
        // Clear token from hash to avoid duplicate triggers on page refresh/navigation
        window.location.hash = '#login';
      }
    }

    // Auth redirection guards
    if (hash === 'login' || hash === 'signup') {
      if (state.user) {
        if (state.user.role === 'user') {
          // Patient is logged in and trying to go to login/signup. Ask to switch to therapist
          showConfirmDialog(
            'You are currently signed in as a Patient. Would you like to log out to access the Physiotherapist section?',
            () => {
              localStorage.removeItem('physio_session');
              state.user = null;
              updateNavHeader();
              window.location.hash = '#login';
              showAuthTab('login');
              const rolePhysio = document.getElementById('role-physio');
              if (rolePhysio) {
                rolePhysio.checked = true;
                rolePhysio.dispatchEvent(new Event('change'));
              }
            },
            () => {
              window.location.hash = '#patient-dashboard';
            }
          );
        } else if (state.user.role === 'physiotherapist') {
          // Therapist is logged in and trying to go to login/signup. Ask to switch to patient
          showConfirmDialog(
            'You are currently signed in as a Physiotherapist. Would you like to log out to book an appointment as a Patient?',
            () => {
              localStorage.removeItem('physio_session');
              state.user = null;
              updateNavHeader();
              window.location.hash = '#signup';
              showAuthTab('signup');
              const rolePatient = document.getElementById('role-patient');
              if (rolePatient) {
                rolePatient.checked = true;
                rolePatient.dispatchEvent(new Event('change'));
              }
            },
            () => {
              window.location.hash = '#physio-dashboard';
            }
          );
        }
        return;
      }
      hash = 'auth';
      showAuthTab(window.location.hash === '#signup' ? 'signup' : 'login');
    }

    if (hash === 'patient-dashboard') {
      if (!state.user) {
        showToast('Please sign in to view patient dashboard.', 'error');
        window.location.hash = '#login';
        return;
      }
      if (state.user.role !== 'user') {
        window.location.hash = '#physio-dashboard';
        return;
      }
    }

    if (hash === 'physio-dashboard') {
      if (!state.user) {
        showToast('Please sign in to view physiotherapist dashboard.', 'error');
        window.location.hash = '#login';
        return;
      }
      if (state.user.role !== 'physiotherapist') {
        window.location.hash = '#patient-dashboard';
        return;
      }
    }

    // Render corresponding view
    activateView(hash);
  };

  window.addEventListener('hashchange', handleRoute);
  // Run once on load
  handleRoute();
}

function activateView(viewKey) {
  // Hide all views
  Object.values(VIEWS).forEach(el => {
    if (el) el.style.display = 'none';
  });

  // Nav menu styling update
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

  // Header options syncing
  updateNavHeader();

  if (viewKey === 'landing') {
    if (VIEWS.landing) VIEWS.landing.style.display = 'block';
    const landingLink = document.getElementById('nav-link-landing');
    if (landingLink) landingLink.classList.add('active');
  } else if (viewKey === 'auth') {
    if (VIEWS.auth) VIEWS.auth.style.display = 'block';
  } else if (viewKey === 'patient-dashboard') {
    if (VIEWS.patient) VIEWS.patient.style.display = 'block';
    const patientLink = document.getElementById('nav-link-patient-dash');
    if (patientLink) patientLink.classList.add('active');
    
    const welcomeName = document.getElementById('patient-welcome-name');
    if (welcomeName && state.user) welcomeName.textContent = state.user.name;
    loadPatientDashboard();
  } else if (viewKey === 'physio-dashboard') {
    if (VIEWS.physio) VIEWS.physio.style.display = 'block';
    const physioLink = document.getElementById('nav-link-physio-dash');
    if (physioLink) physioLink.classList.add('active');
    
    const welcomeName = document.getElementById('physio-welcome-name');
    if (welcomeName && state.user) welcomeName.textContent = state.user.name;
    loadPhysioDashboard();
  }
}

// Nav Header session configuration
function updateNavHeader() {
  const guestGroup = document.getElementById('nav-links-guest');
  const patientGroup = document.getElementById('nav-links-patient');
  const physioGroup = document.getElementById('nav-links-physio');

  if (state.user) {
    if (guestGroup) guestGroup.style.display = 'none';
    if (state.user.role === 'physiotherapist') {
      if (patientGroup) patientGroup.style.display = 'none';
      if (physioGroup) physioGroup.style.display = 'flex';
    } else {
      if (patientGroup) patientGroup.style.display = 'flex';
      if (physioGroup) physioGroup.style.display = 'none';
    }
  } else {
    if (guestGroup) guestGroup.style.display = 'flex';
    if (patientGroup) patientGroup.style.display = 'none';
    if (physioGroup) physioGroup.style.display = 'none';
  }
}

function initNavEvents() {
  const toggleBtn = document.getElementById('nav-toggle-btn');
  const menuLinks = document.getElementById('nav-menu-links');

  // Mobile menu toggle
  if (toggleBtn && menuLinks) {
    toggleBtn.addEventListener('click', () => {
      menuLinks.classList.toggle('open');
    });
  }

  // Close mobile nav menu on link click
  if (menuLinks) {
    menuLinks.addEventListener('click', (e) => {
      if (e.target.classList.contains('nav-link') || e.target.closest('button')) {
        menuLinks.classList.remove('open');
      }
    });
  }

  // Logout actions
  const handleLogout = () => {
    localStorage.removeItem('physio_session');
    state.user = null;
    showToast('Signed out successfully.', 'info');
    window.location.hash = '#landing';
    updateNavHeader();
  };

  const logoutPatient = document.getElementById('nav-btn-logout-patient');
  const logoutPhysio = document.getElementById('nav-btn-logout-physio');
  if (logoutPatient) logoutPatient.addEventListener('click', handleLogout);
  if (logoutPhysio) logoutPhysio.addEventListener('click', handleLogout);
}

// -------------------------------------------------------------
// ONBOARDING & AUTHENTICATION DYNAMICS
// -------------------------------------------------------------
function initAuthFormToggles() {
  const tabLogin = document.getElementById('auth-tab-login-btn');
  const tabSignup = document.getElementById('auth-tab-signup-btn');
  
  if (tabLogin) {
    tabLogin.addEventListener('click', () => {
      window.location.hash = '#login';
    });
  }

  if (tabSignup) {
    tabSignup.addEventListener('click', () => {
      window.location.hash = '#signup';
    });
  }

  // Signup fields toggling based on Patient/Doctor selection
  const rolePatient = document.getElementById('role-patient');
  const rolePhysio = document.getElementById('role-physio');
  const patientFields = document.getElementById('patient-fields-wrapper');
  const physioFields = document.getElementById('physio-fields-wrapper');

  const updateFieldsVisibility = () => {
    if (!rolePatient || !rolePhysio) return;
    if (rolePatient.checked) {
      if (patientFields) patientFields.style.display = 'block';
      if (physioFields) physioFields.style.display = 'none';
      // Set requirements
      document.getElementById('patient-age').required = true;
      document.getElementById('patient-gender').required = true;
      document.getElementById('physio-qualification').required = false;
      document.getElementById('physio-specialization').required = false;
      document.getElementById('physio-fees').required = false;
      document.getElementById('physio-address').required = false;
    } else {
      if (patientFields) patientFields.style.display = 'none';
      if (physioFields) physioFields.style.display = 'block';
      // Set requirements
      document.getElementById('patient-age').required = false;
      document.getElementById('patient-gender').required = false;
      document.getElementById('physio-qualification').required = true;
      document.getElementById('physio-specialization').required = true;
      document.getElementById('physio-fees').required = true;
      document.getElementById('physio-address').required = true;
    }
  };

  if (rolePatient) rolePatient.addEventListener('change', updateFieldsVisibility);
  if (rolePhysio) rolePhysio.addEventListener('change', updateFieldsVisibility);
}

function showAuthTab(tabKey) {
  const tabLogin = document.getElementById('auth-tab-login-btn');
  const tabSignup = document.getElementById('auth-tab-signup-btn');
  const formLogin = document.getElementById('login-form');
  const formSignup = document.getElementById('signup-form');

  if (!tabLogin || !tabSignup || !formLogin || !formSignup) return;

  if (tabKey === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.style.display = 'block';
    formSignup.style.display = 'none';
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    formLogin.style.display = 'none';
    formSignup.style.display = 'block';
  }
}

async function verifyEmailToken(token) {
  try {
    const res = await fetch(`${API_AUTH}/verify?token=${token}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Email verification failed.');
    }
    showToast(data.message, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function initAuthForms() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  // Submit Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch(`${API_AUTH}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Login failed.');
        }

        state.user = data.user;
        localStorage.setItem('physio_session', JSON.stringify(data.user));
        showToast(data.message, 'success');

        if (state.user.role === 'physiotherapist') {
          window.location.hash = '#physio-dashboard';
        } else {
          window.location.hash = '#patient-dashboard';
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }

  // Submit Signup
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const role = signupForm.role.value;
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const contactNumber = document.getElementById('signup-phone').value.trim();

      const payload = { role, name, email, password, contactNumber };

      if (role === 'user') {
        payload.age = document.getElementById('patient-age').value;
        payload.gender = document.getElementById('patient-gender').value;
      } else {
        payload.qualification = document.getElementById('physio-qualification').value.trim();
        payload.specialization = document.getElementById('physio-specialization').value.trim();
        payload.fees = document.getElementById('physio-fees').value;
        payload.clinicAddress = document.getElementById('physio-address').value.trim();
      }

      try {
        const res = await fetch(`${API_AUTH}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Registration failed.');
        }

        showToast(data.message, 'success');
        signupForm.reset();
        
        // Auto expand email simulator to let user verify account
        const drawer = document.getElementById('email-simulator');
        if (drawer) drawer.classList.remove('collapsed');
        
        // Navigate to login
        window.location.hash = '#login';
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }
}

// -------------------------------------------------------------
// PATIENT DASHBOARD FEATURES
// -------------------------------------------------------------
async function loadPatientDashboard() {
  await fetchPhysiotherapists();
  await fetchPatientAppointments();
}

async function fetchPhysiotherapists() {
  const container = document.getElementById('physio-list-container');
  if (!container) return;
  try {
    const res = await fetch(API_PHYSIO);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.physiotherapists = data;
    renderPhysiotherapists();
  } catch (error) {
    container.innerHTML = `<div class="empty-list-message" style="color: var(--color-danger);"><i class="fa-solid fa-circle-exclamation"></i> Error loading specialists: ${error.message}</div>`;
  }
}

function renderPhysiotherapists() {
  const container = document.getElementById('physio-list-container');
  if (!container) return;
  if (state.physiotherapists.length === 0) {
    container.innerHTML = `<div class="empty-list-message"><i class="fa-solid fa-user-doctor"></i> No physiotherapists registered yet.</div>`;
    return;
  }

  container.innerHTML = state.physiotherapists.map(p => {
    const avatarInitials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="physio-card" id="physio-card-${p.id}">
        <div class="physio-avatar">${avatarInitials}</div>
        <div class="physio-info">
          <h4>Dr. ${p.name}</h4>
          <p class="physio-specialty">${p.specialization}</p>
          <p class="physio-qual">${p.qualification}</p>
          <p class="physio-address"><i class="fa-solid fa-location-dot"></i> ${p.clinicAddress}</p>
        </div>
        <div class="physio-booking-meta">
          <div class="physio-fee">$${p.fees} <span>/ session</span></div>
          <button class="btn-book-session" id="btn-book-${p.id}" onclick="openBookingModal('${p.id}')">
            <i class="fa-regular fa-calendar-plus"></i> Book Session
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function fetchPatientAppointments() {
  const container = document.getElementById('patient-appointments-container');
  if (!container || !state.user) return;
  try {
    const res = await fetch('/api/patient/appointments', {
      headers: { 'x-user-id': state.user.id }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty-list-message">
          <i class="fa-solid fa-calendar-xmark"></i>
          No upcoming appointments booked. Choose a therapist to schedule.
        </div>
      `;
      return;
    }

    container.innerHTML = data.map(apt => `
      <div class="appointment-card" id="patient-apt-${apt.id}">
        <div class="apt-meta">
          <span class="apt-date-time"><i class="fa-regular fa-clock"></i> ${apt.date} @ ${apt.timeSlot}</span>
          <span class="apt-status confirmed">${apt.status}</span>
        </div>
        <div class="apt-body">
          <h4>Dr. ${apt.physioName}</h4>
          <p><i class="fa-solid fa-wallet"></i> Status: ${apt.paymentStatus.toUpperCase()} (Card ending ${apt.paymentDetails.lastFourDigits})</p>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="empty-list-message" style="color: var(--color-danger);"><i class="fa-solid fa-circle-exclamation"></i> Error loading bookings: ${error.message}</div>`;
  }
}

// -------------------------------------------------------------
// PATIENT BOOKING MODAL & PAYMENT SIMULATION
// -------------------------------------------------------------
function initBookingModalEvents() {
  const closeBtn = document.getElementById('btn-close-booking-modal');
  const overlay = document.getElementById('booking-modal-overlay');
  const dateInput = document.getElementById('booking-date');
  const proceedBtn = document.getElementById('btn-proceed-to-payment');
  const backBtn = document.getElementById('btn-back-to-slots');

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }
  
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      state.selectedDate = dateInput.value;
      state.selectedSlot = '';
      if (proceedBtn) proceedBtn.disabled = true;
      fetchPhysioSlots();
    });
  }

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      const stepSlots = document.getElementById('booking-step-slots');
      const stepPay = document.getElementById('booking-step-payment');
      if (stepSlots) stepSlots.style.display = 'none';
      if (stepPay) stepPay.style.display = 'block';
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const stepSlots = document.getElementById('booking-step-slots');
      const stepPay = document.getElementById('booking-step-payment');
      if (stepSlots) stepSlots.style.display = 'block';
      if (stepPay) stepPay.style.display = 'none';
    });
  }
}

window.openBookingModal = function(physioId) {
  const overlay = document.getElementById('booking-modal-overlay');
  const dateInput = document.getElementById('booking-date');
  if (!overlay || !dateInput) return;
  
  const physio = state.physiotherapists.find(p => p.id === physioId);
  if (!physio) return;

  state.selectedPhysio = physio;
  state.selectedSlot = '';

  const today = getLocalYMD();
  dateInput.value = today;
  dateInput.min = today;
  state.selectedDate = today;

  document.getElementById('modal-therapist-name').textContent = `Book Session with Dr. ${physio.name}`;
  document.getElementById('modal-therapist-specialty').textContent = `${physio.specialization} (${physio.qualification})`;
  document.getElementById('summary-price').textContent = `$${physio.fees.toFixed(2)}`;

  document.getElementById('booking-step-slots').style.display = 'block';
  document.getElementById('booking-step-payment').style.display = 'none';
  document.getElementById('btn-proceed-to-payment').disabled = true;

  document.getElementById('card-holder').value = '';
  document.getElementById('card-number').value = '';
  document.getElementById('card-expiry').value = '';
  document.getElementById('card-cvv').value = '';
  document.getElementById('vis-card-holder').textContent = state.user ? state.user.name.toUpperCase() : 'CARDHOLDER NAME';
  document.getElementById('vis-card-number').textContent = '•••• •••• •••• ••••';
  document.getElementById('vis-card-expiry').textContent = 'MM/YY';

  overlay.style.display = 'flex';
  fetchPhysioSlots();
};

async function fetchPhysioSlots() {
  const grid = document.getElementById('booking-slots-grid');
  const spinner = document.getElementById('slots-loading-indicator');
  if (!grid) return;
  
  grid.innerHTML = '';
  if (spinner) spinner.style.display = 'block';

  try {
    const res = await fetch(`/api/physiotherapists/${state.selectedPhysio.id}/schedule?date=${state.selectedDate}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (spinner) spinner.style.display = 'none';

    if (data.isDayOff) {
      grid.innerHTML = `<div class="empty-list-message" style="grid-column: 1/-1; width:100%;"><i class="fa-solid fa-mug-hot"></i> Dr. ${state.selectedPhysio.name} has marked this day off.</div>`;
      return;
    }

    if (!data.slots || data.slots.length === 0) {
      grid.innerHTML = `<div class="empty-list-message" style="grid-column: 1/-1; width:100%;"><i class="fa-regular fa-clock"></i> No consultation slots defined by therapist for this day.</div>`;
      return;
    }

    grid.innerHTML = data.slots.map(s => `
      <button type="button" class="booking-slot-btn ${s.booked ? 'booked' : ''}" 
        id="slot-${s.time.replace(/\s|:/g, '')}" 
        ${s.booked ? 'disabled' : ''} 
        onclick="selectBookingSlot('${s.time}')">
        ${s.time}
      </button>
    `).join('');
  } catch (error) {
    if (spinner) spinner.style.display = 'none';
    grid.innerHTML = `<div class="empty-list-message" style="color:var(--color-danger); grid-column: 1/-1;"><i class="fa-solid fa-circle-exclamation"></i> Error loading slots: ${error.message}</div>`;
  }
}

window.selectBookingSlot = function(timeStr) {
  state.selectedSlot = timeStr;
  document.querySelectorAll('.booking-slot-btn').forEach(btn => btn.classList.remove('selected'));
  
  const cleanId = `slot-${timeStr.replace(/\s|:/g, '')}`;
  const targetBtn = document.getElementById(cleanId);
  if (targetBtn) {
    targetBtn.classList.add('selected');
  }

  const proceedBtn = document.getElementById('btn-proceed-to-payment');
  if (proceedBtn) proceedBtn.disabled = false;
};

function initPaymentEvents() {
  const billingForm = document.getElementById('payment-billing-form');
  const cardHolderInput = document.getElementById('card-holder');
  const cardNumberInput = document.getElementById('card-number');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvvInput = document.getElementById('card-cvv');

  const visHolder = document.getElementById('vis-card-holder');
  const visNumber = document.getElementById('vis-card-number');
  const visExpiry = document.getElementById('vis-card-expiry');

  if (cardHolderInput && visHolder) {
    cardHolderInput.addEventListener('input', () => {
      visHolder.textContent = cardHolderInput.value.toUpperCase() || 'CARDHOLDER NAME';
    });
  }

  if (cardNumberInput && visNumber) {
    cardNumberInput.addEventListener('input', () => {
      let val = cardNumberInput.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
      let formatted = '';
      for (let i = 0; i < val.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += val[i];
      }
      cardNumberInput.value = formatted;
      visNumber.textContent = formatted || '•••• •••• •••• ••••';
    });
  }

  if (cardExpiryInput && visExpiry) {
    cardExpiryInput.addEventListener('input', () => {
      let val = cardExpiryInput.value.replace(/\D/g, '');
      if (val.length >= 2) {
        cardExpiryInput.value = val.slice(0, 2) + '/' + val.slice(2, 4);
      } else {
        cardExpiryInput.value = val;
      }
      visExpiry.textContent = cardExpiryInput.value || 'MM/YY';
    });
  }

  if (billingForm) {
    billingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const cardHolder = cardHolderInput.value.trim();
      const cardNumber = cardNumberInput.value.replace(/\s+/g, '');
      const cardExpiry = cardExpiryInput.value;
      const cardCvv = cardCvvInput.value;

      if (cardNumber.length < 16) {
        showToast('Please enter a valid 16-digit card number.', 'error');
        return;
      }
      if (cardExpiry.length < 5) {
        showToast('Please enter a valid expiry date (MM/YY).', 'error');
        return;
      }
      if (cardCvv.length < 3) {
        showToast('Please enter a valid security CVV code.', 'error');
        return;
      }

      const btnText = document.getElementById('payment-btn-text');
      const spinner = document.getElementById('payment-spinner');
      const submitBtn = document.getElementById('btn-confirm-payment');

      if (btnText) btnText.style.display = 'none';
      if (spinner) spinner.style.display = 'inline-block';
      if (submitBtn) submitBtn.disabled = true;

      try {
        const payload = {
          physioId: state.selectedPhysio.id,
          date: state.selectedDate,
          timeSlot: state.selectedSlot,
          paymentDetails: {
            cardNumber,
            expiryDate: cardExpiry,
            cvv: cardCvv
          }
        };

        const res = await fetch(`${API_APPTS}/book`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-id': state.user.id
          },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(data.message, 'success');
        const overlay = document.getElementById('booking-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        billingForm.reset();

        fetchPatientAppointments();
        pollEmails();
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

// -------------------------------------------------------------
// PHYSIOTHERAPIST DASHBOARD FEATURES
// -------------------------------------------------------------
async function loadPhysioDashboard() {
  const timelinePicker = document.getElementById('physio-timeline-date');
  const today = getLocalYMD();
  if (timelinePicker && !timelinePicker.value) {
    timelinePicker.value = today;
  }
  
  await fetchPhysioTimeline();
  await fetchPhysioScheduleSettings();
}

async function fetchPhysioTimeline() {
  const container = document.getElementById('physio-timeline-container');
  const timelinePicker = document.getElementById('physio-timeline-date');
  if (!container || !timelinePicker || !state.user) return;
  const dateVal = timelinePicker.value;

  try {
    const res = await fetch(`/api/physio/appointments?date=${dateVal}`, {
      headers: { 'x-user-id': state.user.id }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderPhysioTimeline(data, dateVal);
  } catch (error) {
    container.innerHTML = `<div class="empty-list-message" style="color: var(--color-danger);"><i class="fa-solid fa-circle-exclamation"></i> Error loading timeline: ${error.message}</div>`;
  }
}

function renderPhysioTimeline(appointments, dateVal) {
  const container = document.getElementById('physio-timeline-container');
  if (!container) return;
  if (appointments.length === 0) {
    container.innerHTML = `
      <div class="empty-list-message">
        <i class="fa-solid fa-calendar-day"></i>
        No sessions booked for ${dateVal}.
      </div>
    `;
    return;
  }

  container.innerHTML = appointments.map((apt, index) => {
    const isFirst = index === 0;
    const isLast = index === appointments.length - 1;
    return `
      <div class="timeline-item" id="physio-apt-${apt.id}">
        <div class="tl-index-badge">${index + 1}</div>
        <div class="tl-details">
          <h4>${apt.patientName}</h4>
          <div class="tl-meta-row">
            <span><i class="fa-regular fa-clock"></i> Slot: <strong>${apt.timeSlot}</strong></span>
            <span><i class="fa-solid fa-wallet"></i> Consultation Fee: <strong>Paid</strong></span>
          </div>
        </div>
        <div class="tl-controls">
          <button class="btn-tl-move" title="Move Up" ${isFirst ? 'disabled' : ''} onclick="moveAppointment('${apt.id}', 'up')">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button class="btn-tl-move" title="Move Down" ${isLast ? 'disabled' : ''} onclick="moveAppointment('${apt.id}', 'down')">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.moveAppointment = async function(aptId, direction) {
  const dateVal = document.getElementById('physio-timeline-date').value;
  try {
    const res = await fetch(`/api/physio/appointments?date=${dateVal}`, {
      headers: { 'x-user-id': state.user.id }
    });
    const appointments = await res.json();
    if (!res.ok) throw new Error(appointments.error);

    const index = appointments.findIndex(a => a.id === aptId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = appointments[index];
      appointments[index] = appointments[index - 1];
      appointments[index - 1] = temp;
    } else if (direction === 'down' && index < appointments.length - 1) {
      const temp = appointments[index];
      appointments[index] = appointments[index + 1];
      appointments[index + 1] = temp;
    }

    const orderedIds = appointments.map(a => a.id);

    const reorderRes = await fetch('/api/physio/appointments/reorder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': state.user.id
      },
      body: JSON.stringify({
        date: dateVal,
        appointmentIdsOrder: orderedIds
      })
    });
    
    const reorderData = await reorderRes.json();
    if (!reorderRes.ok) throw new Error(reorderData.error);

    showToast('Sequence reordered successfully.', 'success');
    renderPhysioTimeline(reorderData.appointments, dateVal);
  } catch (error) {
    showToast(error.message, 'error');
  }
};

async function fetchPhysioScheduleSettings() {
  if (!state.user) return;
  try {
    const res = await fetch(`/api/physiotherapists/${state.user.id}/schedule?date=none`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.activeSlots = data.slots || [];
    state.daysOff = data.daysOff || [];
    
    const feesInput = document.getElementById('schedule-fees');
    if (feesInput) feesInput.value = data.fees || 0;

    renderScheduleSlotsTags();
    renderDaysOffTags();
  } catch (error) {
    showToast(`Error fetching schedule settings: ${error.message}`, 'error');
  }
}

function initPhysioScheduleEvents() {
  const timelinePicker = document.getElementById('physio-timeline-date');
  const scheduleForm = document.getElementById('physio-schedule-form');
  const btnAddSlot = document.getElementById('btn-add-slot-item');
  const btnAddDayoff = document.getElementById('btn-add-dayoff-item');

  if (timelinePicker) timelinePicker.addEventListener('change', fetchPhysioTimeline);

  if (btnAddSlot) {
    btnAddSlot.addEventListener('click', () => {
      const timeVal = document.getElementById('new-slot-time').value;
      if (!timeVal) {
        showToast('Please select a time slot first.', 'warning');
        return;
      }

      const formatted = convert24hTo12h(timeVal);
      if (state.activeSlots.includes(formatted)) {
        showToast('This slot is already added.', 'warning');
        return;
      }

      state.activeSlots.push(formatted);
      state.activeSlots.sort((a, b) => convert12hTo24h(a).localeCompare(convert12hTo24h(b)));
      renderScheduleSlotsTags();
    });
  }

  if (btnAddDayoff) {
    btnAddDayoff.addEventListener('click', () => {
      const dateVal = document.getElementById('new-dayoff-date').value;
      if (!dateVal) {
        showToast('Please select a date to mark off.', 'warning');
        return;
      }

      if (state.daysOff.includes(dateVal)) {
        showToast('This date is already marked off.', 'warning');
        return;
      }

      state.daysOff.push(dateVal);
      state.daysOff.sort();
      renderDaysOffTags();
    });
  }

  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fees = Number(document.getElementById('schedule-fees').value);

      try {
        const res = await fetch('/api/physio/schedule/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': state.user.id
          },
          body: JSON.stringify({
            slots: state.activeSlots,
            daysOff: state.daysOff,
            fees
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(data.message, 'success');
        state.user.fees = fees;
        localStorage.setItem('physio_session', JSON.stringify(state.user));
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }
}

function renderScheduleSlotsTags() {
  const container = document.getElementById('active-slots-tags-container');
  if (!container) return;
  if (state.activeSlots.length === 0) {
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">No active slots. Add slots above.</span>`;
    return;
  }

  container.innerHTML = state.activeSlots.map(slot => `
    <span class="slot-tag">
      ${slot}
      <button type="button" onclick="removeSlotTag('${slot}')" aria-label="Remove Slot ${slot}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </span>
  `).join('');
}

window.removeSlotTag = function(slotStr) {
  state.activeSlots = state.activeSlots.filter(s => s !== slotStr);
  renderScheduleSlotsTags();
};

function renderDaysOffTags() {
  const container = document.getElementById('daysoff-tags-container');
  if (!container) return;
  if (state.daysOff.length === 0) {
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">No marked days off.</span>`;
    return;
  }

  container.innerHTML = state.daysOff.map(d => `
    <span class="dayoff-tag">
      ${d}
      <button type="button" onclick="removeDayoffTag('${d}')" aria-label="Remove Day Off ${d}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </span>
  `).join('');
}

window.removeDayoffTag = function(dateStr) {
  state.daysOff = state.daysOff.filter(d => d !== dateStr);
  renderDaysOffTags();
};

// -------------------------------------------------------------
// DEVELOPER EMAIL SIMULATOR DRAWER
// -------------------------------------------------------------
function initSimulatorEvents() {
  const toggleBtn = document.getElementById('btn-toggle-simulator');
  const drawer = document.getElementById('email-simulator');
  const clearBtn = document.getElementById('btn-clear-simulator-emails');

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = drawer.classList.contains('collapsed');
      if (isCollapsed) {
        drawer.classList.remove('collapsed');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        drawer.classList.add('collapsed');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_DEV}/clear-emails`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to clear emails.');
        showToast('Simulator emails cleared.', 'info');
        state.emails = [];
        state.activeEmailId = null;
        renderEmailSimulator();
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  }
}

async function pollEmails() {
  try {
    const res = await fetch(`${API_DEV}/emails`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (JSON.stringify(state.emails) !== JSON.stringify(data)) {
      state.emails = data;
      renderEmailSimulator();
    }
  } catch (error) {
    console.error('Simulator polling failed:', error.message);
  }
}

function renderEmailSimulator() {
  const badgeCount = document.getElementById('simulator-badge-count');
  if (badgeCount) badgeCount.textContent = state.emails.length;

  const listContainer = document.getElementById('simulator-email-list');
  const viewerContainer = document.getElementById('simulator-email-viewer');
  if (!listContainer || !viewerContainer) return;

  if (state.emails.length === 0) {
    listContainer.innerHTML = `<div class="empty-inbox-message">No emails triggered yet. Onboard users or book appointments to see simulated emails.</div>`;
    viewerContainer.innerHTML = `<div class="empty-viewer-message">Select an email from the inbox list to read details.</div>`;
    return;
  }

  listContainer.innerHTML = state.emails.map(email => {
    const isSelected = state.activeEmailId === email.id;
    const timeFormatted = new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `
      <div class="sim-email-item ${isSelected ? 'selected' : ''}" onclick="selectSimulatorEmail('${email.id}')">
        <h5>${email.to}</h5>
        <div class="sim-email-subject">${email.subject}</div>
        <div class="sim-email-date">${timeFormatted}</div>
      </div>
    `;
  }).join('');

  if (state.activeEmailId) {
    const activeEmail = state.emails.find(e => e.id === state.activeEmailId);
    if (activeEmail) {
      viewerContainer.innerHTML = `
        <div class="email-view-header">
          <h4>${activeEmail.subject}</h4>
          <p>From: <span>PhysioConnect System &lt;noreply@physioconnect.com&gt;</span></p>
          <p>To: <span>${activeEmail.to}</span></p>
          <p>Date: <span>${new Date(activeEmail.sentAt).toLocaleString()}</span></p>
        </div>
        <div class="email-view-body">
          ${activeEmail.html || `<p style="white-space: pre-wrap;">${activeEmail.body}</p>`}
        </div>
      `;

      const verifyLinks = viewerContainer.querySelectorAll('a');
      verifyLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
          const urlStr = link.getAttribute('href');
          if (urlStr && urlStr.includes('verifyToken=')) {
            e.preventDefault();
            const token = urlStr.split('verifyToken=')[1];
            await verifyEmailToken(token);
            pollEmails();
          }
        });
      });
    } else {
      state.activeEmailId = null;
      viewerContainer.innerHTML = `<div class="empty-viewer-message">Select an email from the inbox list to read details.</div>`;
    }
  } else {
    viewerContainer.innerHTML = `<div class="empty-viewer-message">Select an email from the inbox list to read details.</div>`;
  }
}

window.selectSimulatorEmail = function(emailId) {
  state.activeEmailId = emailId;
  const splitView = document.getElementById('simulator-split-view');
  if (splitView) splitView.classList.add('viewing-email');
  renderEmailSimulator();
};

// -------------------------------------------------------------
// HELPER CONVERSIONS & TOAST
// -------------------------------------------------------------
function convert24hTo12h(timeStr) {
  let [hours, minutes] = timeStr.split(':');
  hours = parseInt(hours, 10);
  const modifier = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours.toString().padStart(2, '0')}:${minutes} ${modifier}`;
}

function convert12hTo24h(timeStr) {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

function showToast(message, type = 'info') {
  const wrapper = document.getElementById('toast-wrapper');
  if (!wrapper) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-xmark';
  if (type === 'warning') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <span class="toast-icon"><i class="fa-solid ${iconClass}"></i></span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Close Toast Notification"><i class="fa-solid fa-xmark"></i></button>
  `;

  wrapper.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });
  }

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastSlideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// Reusable custom confirmation modal with premium glassmorphism styling
function showConfirmDialog(message, onConfirm, onCancel = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.animation = 'fadeIn 0.2s ease forwards';
  
  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 440px; text-align: center; padding: 32px;">
      <div style="font-size: 3rem; color: var(--color-warning); margin-bottom: 20px;">
        <i class="fa-solid fa-circle-question"></i>
      </div>
      <h3 style="font-size: 1.35rem; margin-bottom: 12px; font-family: var(--font-headings);">Switch Sessions?</h3>
      <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 28px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 14px; justify-content: center;">
        <button type="button" class="btn-back" id="confirm-cancel-btn" style="height: 44px; margin-top: 0; padding: 0 24px;">Cancel</button>
        <button type="button" class="submit-btn" id="confirm-ok-btn" style="height: 44px; margin-top: 0; background: var(--color-primary); flex: 1;">Logout & Switch</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const cleanUp = () => {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#confirm-ok-btn').addEventListener('click', () => {
    cleanUp();
    if (onConfirm) onConfirm();
  });

  overlay.querySelector('#confirm-cancel-btn').addEventListener('click', () => {
    cleanUp();
    if (onCancel) onCancel();
  });
}

// Timezone-safe local YYYY-MM-DD date formatter
function getLocalYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
