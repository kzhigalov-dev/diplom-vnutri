import {
  getEmailJSConfig,
  validateContactPayload,
  formatContactTemplateParams
} from './emailjs-config.js?v=20261113-navigation';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

async function sendEmailPayload(templateParams, statusEl, submitBtn, submitText, formEl) {
  const originalLabel = submitText?.textContent || 'Отправить сообщение';
  const config = getEmailJSConfig();
  const hasKeys = Boolean(config.publicKey && config.serviceId && config.templateId);

  if (submitBtn) submitBtn.setAttribute('aria-disabled', 'true');
  if (submitText) submitText.textContent = 'Отправляем…';
  if (statusEl) {
    statusEl.hidden = false;
    statusEl.className = 'notice contact-status';
    statusEl.innerHTML = '<span class="campus-spinner campus-spinner-small" aria-hidden="true"></span> Отправляем сообщение…';
  }

  try {
    if (hasKeys && typeof window.emailjs !== 'undefined') {
      window.emailjs.init({ publicKey: config.publicKey });
      await window.emailjs.send(
        config.serviceId,
        config.templateId,
        templateParams,
        config.publicKey
      );
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'contact-status is-success';
        statusEl.innerHTML = '<strong>Сообщение отправлено.</strong>';
      }
      formEl.reset();
      const roomInput = formEl.querySelector('[name="room"]');
      if (roomInput) roomInput.value = '';
    } else {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'notice contact-status';
        statusEl.innerHTML = !hasKeys
          ? 'Отправка пока недоступна. Попробуйте позже. Текст остался в форме.'
          : 'Сервис отправки ещё загружается. Повторите попытку через несколько секунд.';
      }
    }
  } catch (error) {
    console.error('Ошибка EmailJS:', error);
    const errText = error?.text || error?.message || 'Не удалось отправить сообщение';
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.className = 'contact-status is-error';
      statusEl.innerHTML = `<strong>Ошибка отправки:</strong> ${escapeHTML(errText)}.<br><small>Текст остался в форме. Попробуйте отправить его позже.</small>`;
    }
  } finally {
    if (submitBtn) submitBtn.removeAttribute('aria-disabled');
    if (submitText) submitText.textContent = originalLabel;
  }
}

function bindForm(form) {
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';

  const statusEl = form.querySelector('.contact-status') || form.parentElement?.querySelector('.contact-status');
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitText = submitBtn?.querySelector('span') || submitBtn;
  const fields = {
    name: form.elements.namedItem('user_name'),
    email: form.elements.namedItem('user_email'),
    message: form.elements.namedItem('message'),
  };
  const validate = () => validateContactPayload({
    name: fields.name?.value,
    email: fields.email?.value,
    message: fields.message?.value,
  });
  const updateErrors = Object.entries(fields).flatMap(([key, input]) => {
    if (!input) return [];
    const error = document.createElement('span');
    error.id = `${input.id || `${form.id}-${key}`}-error`;
    error.className = 'contact-field-error';
    error.hidden = true;
    const labelText = input.closest('label')?.firstElementChild;
    if (labelText && !input.hasAttribute('aria-labelledby') && !input.hasAttribute('aria-label')) {
      labelText.id ||= `${input.id || `${form.id}-${key}`}-label`;
      input.setAttribute('aria-labelledby', labelText.id);
    }
    input.after(error);
    const update = message => {
      const descriptions = (input.getAttribute('aria-describedby') || '')
        .split(/\s+/).filter(id => id && id !== error.id);
      if (message) descriptions.push(error.id);
      if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
      else input.removeAttribute('aria-describedby');
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      error.textContent = message || '';
      error.hidden = !message;
    };
    update();
    input.addEventListener('input', () => {
      if (error.hidden || validate().errors[key]) return;
      if (statusEl?.textContent === error.textContent) {
        statusEl.hidden = true;
        statusEl.textContent = '';
      }
      update();
    });
    form.addEventListener('reset', () => update());
    return [errors => update(errors[key])];
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitBtn?.disabled || submitBtn?.getAttribute('aria-disabled') === 'true') return;
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = '';
    }

    const validation = validate();
    updateErrors.forEach(update => update(validation.errors));
    if (!validation.valid) {
      const [firstError, message] = Object.entries(validation.errors)[0];
      const firstField = fields[firstError];
      if (statusEl && firstField && document.activeElement === firstField) {
        statusEl.hidden = false;
        statusEl.className = 'contact-status is-error';
        statusEl.textContent = message;
      }
      firstField?.focus();
      return;
    }

    const templateParams = formatContactTemplateParams({
      name: fields.name?.value,
      email: fields.email?.value,
      subject: form.elements.namedItem('subject')?.value,
      room: form.elements.namedItem('room')?.value,
      message: fields.message?.value,
    });

    await sendEmailPayload(templateParams, statusEl, submitBtn, submitText, form);
  });
}

export function openContactModal(options = {}) {
  document.getElementById('nav-project-menu')?.hidePopover?.();
  if (typeof window.activateContactMode === 'function') {
    window.activateContactMode(options);
    return;
  }
  const modal = document.getElementById('nav-contact-modal');
  if (modal) {
    if (options.room) {
      const roomInput = modal.querySelector('[name="room"]');
      if (roomInput) roomInput.value = options.room;
    }
    if (options.subject) {
      const subjSelect = modal.querySelector('[name="subject"]');
      if (subjSelect) subjSelect.value = options.subject;
    }
    try {
      if (typeof modal.showModal === 'function') {
        if (!modal.open) modal.showModal();
      } else {
        modal.setAttribute('open', '');
        modal.style.display = 'block';
      }
    } catch {
      modal.setAttribute('open', '');
      modal.style.display = 'block';
    }
    setTimeout(() => {
      modal.querySelector('[name="user_name"]')?.focus();
    }, 50);
  }

  const sidebarForm = document.getElementById('sidebar-contact-form');
  if (sidebarForm) {
    if (options.room) {
      const roomInput = sidebarForm.querySelector('[name="room"]');
      if (roomInput) roomInput.value = options.room;
    }
    if (options.subject) {
      const subjSelect = sidebarForm.querySelector('[name="subject"]');
      if (subjSelect) subjSelect.value = options.subject;
    }
  }
}

/**
 * Инициализация всех форм на странице
 */
let contactInitialized = false;
export function initContactForm() {
  if (contactInitialized) return;
  contactInitialized = true;
  document.querySelectorAll('form.contact-form, #contact-form, #sidebar-contact-form, #feedback-page-form').forEach(bindForm);

  const modal = document.getElementById('nav-contact-modal');
  const closeBtn = document.getElementById('nav-contact-close');
  if (modal && closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else { modal.removeAttribute('open'); modal.style.display = 'none'; }
    });
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!inDialog) {
        if (typeof modal.close === 'function') modal.close();
        else { modal.removeAttribute('open'); modal.style.display = 'none'; }
      }
    });
  }

  // Слушатели открытия
  document.querySelectorAll('#nav-contact-open, #nav-contact-footer-btn, [data-open-contact]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const room = btn.getAttribute('data-contact-room') || '';
      const subject = btn.getAttribute('data-contact-subject') || '';
      openContactModal({ room, subject });
    });
  });

  // Проверка хэша
  function checkHash() {
    if (location.hash === '#contact' || location.hash === '#feedback') {
      openContactModal();
    }
  }
  window.addEventListener('hashchange', checkHash);
  checkHash();
}

window.openContactModal = openContactModal;

// Автоматический запуск при загрузке документа
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
  } else {
    initContactForm();
  }
}
