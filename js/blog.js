// Blog posts loader for home page
(async function () {
  const container = document.getElementById('blog-posts');
  const paginationEl = document.getElementById('pagination');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page')) || 1;

  try {
    const data = await apiFetch(`/api/posts?page=${page}&limit=5`);

    if (data.posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No blog posts yet.</p>
          <p class="text-muted">Check back soon for updates from the fellowship.</p>
        </div>`;
      return;
    }

    container.innerHTML = data.posts.map(post => `
      <article class="post-card">
        <h2><a href="post.html?slug=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <div class="post-meta">
          <span>${formatDate(post.created_at)}</span>
          <span>${escapeHtml(post.author)}</span>
        </div>
        <p class="post-preview">${escapeHtml(post.preview)}...</p>
        <a href="post.html?slug=${encodeURIComponent(post.slug)}" class="read-more">Read More &rarr;</a>
      </article>
    `).join('');

    // Pagination
    if (data.totalPages > 1 && paginationEl) {
      let html = '';
      if (page > 1) {
        html += `<a href="?page=${page - 1}">&laquo; Prev</a>`;
      }
      for (let i = 1; i <= data.totalPages; i++) {
        if (i === page) {
          html += `<span class="current">${i}</span>`;
        } else {
          html += `<a href="?page=${i}">${i}</a>`;
        }
      }
      if (page < data.totalPages) {
        html += `<a href="?page=${page + 1}">Next &raquo;</a>`;
      }
      paginationEl.innerHTML = `<div class="pagination">${html}</div>`;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Welcome to Christian Believers Fellowship</p>
        <p class="text-muted">Blog posts will appear here when the server is connected.</p>
      </div>`;
  }
})();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
