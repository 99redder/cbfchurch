// Photo gallery lightbox
(function () {
  const gallery = document.querySelector('.gallery-grid');
  if (!gallery) return;

  let items = Array.from(gallery.querySelectorAll('.gallery-item img'));

  // Create lightbox elements
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-label', 'Photo viewer');
  lightbox.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <button class="lightbox-nav lightbox-prev" aria-label="Previous photo">&#8249;</button>
    <img src="" alt="">
    <button class="lightbox-nav lightbox-next" aria-label="Next photo">&#8250;</button>
  `;
  document.body.appendChild(lightbox);

  const lbImg = lightbox.querySelector('img');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  let currentIndex = 0;

  function refreshItems() {
    items = Array.from(gallery.querySelectorAll('.gallery-item img'));
  }

  async function loadUploadedPhotos() {
    if (typeof API_BASE === 'undefined') return;
    try {
      const res = await fetch(`${API_BASE}/api/gallery`);
      if (!res.ok) return;
      const photos = await res.json();
      photos.forEach(photo => {
        const img = document.createElement('img');
        img.src = `${API_BASE}/uploads/gallery/${photo.filename}`;
        img.alt = photo.alt || 'CBF Fellowship photo';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          if (img.parentElement) img.parentElement.remove();
          refreshItems();
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-item';
        wrapper.appendChild(img);
        gallery.appendChild(wrapper);
      });
      refreshItems();
    } catch {
      // ignore
    }
  }

  function open(index) {
    refreshItems();
    currentIndex = index;
    const src = items[index].getAttribute('data-full') || items[index].src;
    lbImg.src = src;
    lbImg.alt = items[index].alt || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function prev() {
    if (items.length === 0) return;
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    open(currentIndex);
  }

  function next() {
    if (items.length === 0) return;
    currentIndex = (currentIndex + 1) % items.length;
    open(currentIndex);
  }

  // Event listeners
  gallery.addEventListener('click', (e) => {
    const img = e.target.closest('.gallery-item img');
    if (!img) return;
    refreshItems();
    const index = items.indexOf(img);
    if (index >= 0) open(index);
  });

  items.forEach((img) => {
    img.addEventListener('error', () => {
      if (img.parentElement) img.parentElement.remove();
      refreshItems();
    });
  });

  loadUploadedPhotos();

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });
})();
