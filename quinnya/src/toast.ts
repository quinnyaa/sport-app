export function showToast(message: string, type: 'success' | 'error') {
  const el = document.createElement('div')
  el.className = `toast toast--${type}`
  el.textContent = message
  document.body.appendChild(el)

  requestAnimationFrame(() => el.classList.add('toast--visible'))

  setTimeout(() => {
    el.classList.remove('toast--visible')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
  }, 3000)
}
