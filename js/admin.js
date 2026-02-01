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

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
