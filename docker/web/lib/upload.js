const multer = require('multer');
const { MAX_FILES_PER_TICKET } = require('./attachments');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: MAX_FILES_PER_TICKET,
  },
});

const evidenceUpload = upload.array('attachments', MAX_FILES_PER_TICKET);

function handleEvidenceUpload(req, res, next) {
  evidenceUpload(req, res, (err) => {
    if (!err) return next();
    req.uploadError =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'A file exceeds the 20MB limit.'
        : err.message || 'Upload failed.';
    return next();
  });
}

module.exports = { handleEvidenceUpload };
