export const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Content = result.includes(',') ? result.split(',').pop() : result;
      resolve(base64Content || '');
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };

    reader.readAsDataURL(file);
  });

export const formatAllowedSubmissionFormats = (formats = []) => {
  if (!Array.isArray(formats) || formats.length === 0) {
    return 'Any file format';
  }

  return formats.map((format) => `.${String(format).replace(/^\./, '').toLowerCase()}`).join(', ');
};

export const triggerBlobDownload = (blob, fileName = 'download') => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const hasTaskSubmission = (task) =>
  Boolean(task?.submission?.fileName && task?.submission?.uploadedAt);
