// Article archives loader
(async function () {
  const container = document.getElementById('archives');
  if (!container) return;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  try {
    const data = await apiFetch('/api/posts/archives');

    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No archived posts yet.</p></div>';
      return;
    }

    // Group by year
    const years = {};
    data.forEach(item => {
      if (!years[item.year]) years[item.year] = [];
      years[item.year].push(item);
    });

    let html = '';
    Object.keys(years).sort((a, b) => b - a).forEach(year => {
      const months = years[year];
      html += `
        <details class="archive-year" ${year === Object.keys(years).sort((a, b) => b - a)[0] ? 'open' : ''}>
          <summary>${year}</summary>
          <ul class="archive-months">
            ${months.map(m => {
              const monthName = monthNames[parseInt(m.month) - 1];
              return `<li><a href="index.html?year=${m.year}&month=${m.month}">${monthName}</a> <span class="count">(${m.count})</span></li>`;
            }).join('')}
          </ul>
        </details>`;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Archives will appear here when the server is connected.</p></div>';
  }
})();
