export function logError(error, context = '') {
  console.error(`[VALTRAIN${context ? `:${context}` : ''}]`, error);
}

export function userErrorMessage(error, fallback = 'Произошла ошибка. Попробуй ещё раз.') {
  if (!error) return fallback;
  if (error.code === 'VALIDATION_ERROR' || error.name === 'ValidationError') return error.message;
  if (error.code === '23505') return 'Такая запись уже существует.';
  if (error.code === '23503') return 'Связанная запись не найдена.';
  if (error.code === '23514') return 'Данные не прошли проверку базы.';
  return fallback;
}

export function showError(error, fallback, context = '') {
  logError(error, context);
  const message = userErrorMessage(error, fallback);
  let root = document.getElementById('valtrain-notice');
  if (!root) {
    root = document.createElement('div');
    root.id = 'valtrain-notice';
    root.className = 'valtrain-notice';
    root.setAttribute('role', 'alert');
    document.body.append(root);
  }
  root.textContent = message;
  root.classList.add('is-visible');
  clearTimeout(root._hideTimer);
  root._hideTimer = setTimeout(() => root.classList.remove('is-visible'), 5000);
}


export function showSuccess(message) {
  let root = document.getElementById('valtrain-notice');
  if (!root) {
    root = document.createElement('div');
    root.id = 'valtrain-notice';
    root.className = 'valtrain-notice';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    document.body.append(root);
  }
  root.textContent = message;
  root.classList.remove('is-error');
  root.classList.add('is-visible');
  clearTimeout(root._hideTimer);
  root._hideTimer = setTimeout(() => root.classList.remove('is-visible'), 3500);
}
