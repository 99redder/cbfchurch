// Admin panel JavaScript
const API_BASE = 'https://cbfchurch.onrender.com';

// Global user info
let currentUser = null;

// Auth check - redirect to login if not authenticated
(async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
      }
      return;
    }
    const user = await res.json();
    currentUser = user;
    const userEl = document.getElementById('admin-user');
    if (userEl) userEl.textContent = `Logged in as ${user.username}`;

    // Show "Manage Users" link for superadmins
    const manageUsersLink = document.getElementById('manage-users-link');
    if (manageUsersLink) {
      manageUsersLink.style.display = user.role === 'superadmin' ? '' : 'none';
    }

    // On the users page, redirect non-superadmins
    if (window.location.pathname.includes('users.html') && user.role !== 'superadmin') {
      window.location.href = 'dashboard.html';
    }
  } catch {
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
  }
})();

// Logout handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch {}
    window.location.href = 'login.html';
  });
}

// Dashboard: load posts
const postsListEl = document.getElementById('posts-list');
if (postsListEl) {
  loadDashboardPosts();
}

// Gallery admin list
const galleryAdminListEl = document.getElementById('gallery-admin-list');
if (galleryAdminListEl) {
  loadGalleryAdmin();
}

async function loadDashboardPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/posts`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      throw new Error('Failed to load posts');
    }

    const posts = await res.json();

    if (posts.length === 0) {
      postsListEl.innerHTML = `
        <div class="empty-state">
          <p>No blog posts yet.</p>
          <p class="text-muted">Click "New Post" to create your first blog entry.</p>
        </div>`;
      return;
    }

    postsListEl.innerHTML = `
      <table class="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${posts.map(post => `
            <tr>
              <td>${escapeHtml(post.title)}</td>
              <td>${escapeHtml(post.author)}</td>
              <td>${formatDate(post.created_at)}</td>
              <td class="actions">
                <a href="editor.html?id=${post.id}">Edit</a>
                <a href="#" class="delete-link" data-id="${post.id}" data-title="${escapeHtml(post.title)}">Delete</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    postsListEl.querySelectorAll('.delete-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = link.dataset.id;
        const title = link.dataset.title;

        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

        try {
          const res = await fetch(`${API_BASE}/api/admin/posts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!res.ok) {
            if (res.status === 401) { window.location.href = 'login.html'; return; }
            alert('Failed to delete post');
            return;
          }

          loadDashboardPosts();
        } catch {
          alert('Could not connect to server');
        }
      });
    });
  } catch (err) {
    postsListEl.innerHTML = `
      <div class="empty-state">
        <p>Could not load posts. Make sure the API server is running.</p>
      </div>`;
  }
}

// Users page: load users
const usersListEl = document.getElementById('users-list');
if (usersListEl) {
  loadUsers();
}

async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      if (res.status === 403) { window.location.href = 'dashboard.html'; return; }
      throw new Error('Failed to load users');
    }

    const users = await res.json();

    if (users.length === 0) {
      usersListEl.innerHTML = '<div class="empty-state"><p>No users found.</p></div>';
      return;
    }

    usersListEl.innerHTML = `
      <table class="posts-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${escapeHtml(user.username)}</td>
              <td><span class="role-badge role-${user.role}">${user.role}</span></td>
              <td>${formatDate(user.created_at)}</td>
              <td class="actions">
                ${currentUser && user.id === currentUser.userId
                  ? '<span class="text-muted">You</span>'
                  : `<a href="#" class="delete-user-link" data-id="${user.id}" data-username="${escapeHtml(user.username)}">Delete</a>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    usersListEl.querySelectorAll('.delete-user-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = link.dataset.id;
        const username = link.dataset.username;

        if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;

        try {
          const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || 'Failed to delete user');
            return;
          }

          loadUsers();
        } catch {
          alert('Could not connect to server');
        }
      });
    });
  } catch (err) {
    usersListEl.innerHTML = `
      <div class="empty-state">
        <p>Could not load users.</p>
      </div>`;
  }
}

// Create user form
const createUserForm = document.getElementById('create-user-form');
if (createUserForm) {
  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('user-error');
    const successEl = document.getElementById('user-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    if (!username || !password) {
      errorEl.textContent = 'Username and password are required';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, role })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errorEl.textContent = data.error || 'Failed to create account';
        errorEl.style.display = 'block';
        return;
      }

      successEl.textContent = `Account "${username}" created successfully`;
      successEl.style.display = 'block';
      createUserForm.reset();
      loadUsers();
    } catch {
      errorEl.textContent = 'Could not connect to server';
      errorEl.style.display = 'block';
    }
  });
}

// Gallery upload
const galleryUploadForm = document.getElementById('gallery-upload-form');
if (galleryUploadForm) {
  galleryUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('gallery-image');
    const altInput = document.getElementById('gallery-alt');
    const errorEl = document.getElementById('gallery-upload-error');
    const successEl = document.getElementById('gallery-upload-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!file) {
      errorEl.textContent = 'Please choose an image to upload.';
      errorEl.style.display = 'block';
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      errorEl.textContent = 'Image is too large (max 4MB).';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch(`${API_BASE}/api/admin/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          imageData: dataUrl,
          alt: altInput ? altInput.value.trim() : ''
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errorEl.textContent = data.error || 'Failed to upload photo';
        errorEl.style.display = 'block';
        return;
      }

      successEl.textContent = 'Photo uploaded successfully.';
      successEl.style.display = 'block';
      galleryUploadForm.reset();
      if (galleryAdminListEl) {
        loadGalleryAdmin();
      }
    } catch {
      errorEl.textContent = 'Could not connect to server.';
      errorEl.style.display = 'block';
    }
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function loadGalleryAdmin() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/gallery`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      throw new Error('Failed to load gallery');
    }

    const photos = await res.json();
    if (photos.length === 0) {
      galleryAdminListEl.innerHTML = '<div class="empty-state"><p>No gallery photos yet.</p></div>';
      return;
    }

    galleryAdminListEl.innerHTML = photos.map((photo, index) => `
      <div class="gallery-admin-item" data-id="${photo.id}">
        <img class="gallery-admin-thumb" src="${API_BASE}/uploads/gallery/${photo.filename}" alt="${escapeHtml(photo.alt || 'Gallery photo')}">
        <div class="gallery-admin-meta">
          <strong>${escapeHtml(photo.alt || 'Gallery photo')}</strong>
          <span class="text-muted">${formatDate(photo.created_at)}</span>
        </div>
        <div class="gallery-admin-actions">
          <button type="button" class="move-up" ${index === 0 ? 'disabled' : ''}>Up</button>
          <button type="button" class="move-down" ${index === photos.length - 1 ? 'disabled' : ''}>Down</button>
          <button type="button" class="delete-photo">Delete</button>
        </div>
      </div>
    `).join('');

    galleryAdminListEl.querySelectorAll('.move-up').forEach(btn => {
      btn.addEventListener('click', () => moveGalleryItem(btn.closest('.gallery-admin-item'), -1));
    });
    galleryAdminListEl.querySelectorAll('.move-down').forEach(btn => {
      btn.addEventListener('click', () => moveGalleryItem(btn.closest('.gallery-admin-item'), 1));
    });
    galleryAdminListEl.querySelectorAll('.delete-photo').forEach(btn => {
      btn.addEventListener('click', () => deleteGalleryItem(btn.closest('.gallery-admin-item')));
    });
  } catch {
    galleryAdminListEl.innerHTML = '<div class="empty-state"><p>Could not load gallery photos.</p></div>';
  }
}

async function moveGalleryItem(item, direction) {
  if (!item) return;
  const target = direction < 0 ? item.previousElementSibling : item.nextElementSibling;
  if (!target) return;

  if (direction < 0) {
    item.parentElement.insertBefore(item, target);
  } else {
    item.parentElement.insertBefore(target, item);
  }

  await saveGalleryOrder();
  updateGalleryMoveButtons();
}

function updateGalleryMoveButtons() {
  if (!galleryAdminListEl) return;
  const items = Array.from(galleryAdminListEl.querySelectorAll('.gallery-admin-item'));
  items.forEach((item, index) => {
    const up = item.querySelector('.move-up');
    const down = item.querySelector('.move-down');
    if (up) up.disabled = index === 0;
    if (down) down.disabled = index === items.length - 1;
  });
}

async function saveGalleryOrder() {
  const items = Array.from(galleryAdminListEl.querySelectorAll('.gallery-admin-item'));
  const orderedIds = items.map(item => item.dataset.id);
  try {
    await fetch(`${API_BASE}/api/admin/gallery/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderedIds })
    });
  } catch {
    // ignore
  }
}

async function deleteGalleryItem(item) {
  if (!item) return;
  const id = item.dataset.id;
  if (!confirm('Delete this photo? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      alert('Failed to delete photo');
      return;
    }
    item.remove();
    updateGalleryMoveButtons();
    await saveGalleryOrder();
  } catch {
    alert('Could not connect to server');
  }
}
