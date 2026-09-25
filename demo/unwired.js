// The whole colorsbymax setup for this page: one import. (A site would write
// `import 'colorsbymax/auto'`; the demo imports the source directly.)
import '../src/auto.js'

// Normal site behaviour, to show re-colouring keeps up with changes after load.
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t === tab)
  })
}
setTimeout(() => {
  const card = document.createElement('div')
  card.className = 'card'
  card.innerHTML = '<div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" /></svg></div><h3>Added later</h3><p>This card arrived after the page loaded.</p>'
  document.querySelector('main').append(card)
}, 1500)
