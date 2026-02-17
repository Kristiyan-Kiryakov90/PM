/**
 * Reports Export
 * CSV export and date range utilities
 */

/**
 * Export data to CSV
 * @param {Array} data - Array of objects to export
 * @param {string} filename - CSV filename
 */
export function exportToCSV(data, filename = 'report.csv') {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get date range presets
 * @returns {Object} Common date range presets
 */
export function getDateRangePresets() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    today: {
      label: 'Today',
      startDate: today.toISOString(),
      endDate: now.toISOString(),
    },
    last7Days: {
      label: 'Last 7 Days',
      startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: now.toISOString(),
    },
    last30Days: {
      label: 'Last 30 Days',
      startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: now.toISOString(),
    },
    thisMonth: {
      label: 'This Month',
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: now.toISOString(),
    },
    lastMonth: {
      label: 'Last Month',
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
    },
    thisYear: {
      label: 'This Year',
      startDate: new Date(now.getFullYear(), 0, 1).toISOString(),
      endDate: now.toISOString(),
    },
  };
}
