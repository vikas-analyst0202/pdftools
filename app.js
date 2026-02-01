/**
 * Main Application logic for PDF Master
 */

const app = {
    currentTool: null,
    selectedFiles: [],
    downloadBlob: null,
    downloadFileName: null,

    init() {
        this.bindEvents();
        this.selectTool('merge'); // Default to merge tool
        console.log('PDF Master Initialized');
    },

    bindEvents() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const processBtn = document.getElementById('process-btn');
        const themeToggle = document.getElementById('theme-toggle');

        // File Selection
        fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag and Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Click on drop zone to open file dialog
        dropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'SPAN') {
                fileInput.click();
            }
        });

        // Processing
        processBtn.addEventListener('click', () => this.process());

        // Theme Toggle
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const icon = themeToggle.querySelector('i');
            if (document.body.classList.contains('light-mode')) {
                icon.setAttribute('data-lucide', 'sun');
            } else {
                icon.setAttribute('data-lucide', 'moon');
            }
            lucide.createIcons();
        });
    },

    selectTool(tool) {
        // Update current tool
        this.currentTool = tool;

        // Update button states
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${tool}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update sidebar title and options
        const titleMap = {
            'merge': 'Merge Options',
            'split': 'Split Options',
            'compress': 'Compress Options'
        };
        document.getElementById('sidebar-title').textContent = titleMap[tool];

        // Setup tool-specific options in sidebar
        this.setupToolOptions(tool);

        // Clear files when switching tools (optional, can be changed)
        this.clearFiles();

        // Hide overlays
        this.hideOverlays();
    },

    setupToolOptions(tool) {
        const optionsContainer = document.getElementById('tool-options');

        if (tool === 'merge') {
            optionsContainer.innerHTML = `
                <div class="tool-option-group">
                    <div class="checkbox-group">
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-toc">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Hyperlinked TOC</span>
                                <span class="checkbox-desc">Generate a table of contents on page 1</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-filename">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Source Filename</span>
                                <span class="checkbox-desc">Add source filename to each page</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-orig-pages">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Original Page Numbers</span>
                                <span class="checkbox-desc">Add original - 1/56 to each page</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-final-pages">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Final Page Numbers</span>
                                <span class="checkbox-desc">Add sequential page numbers to final doc</span>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        } else if (tool === 'split') {
            optionsContainer.innerHTML = `
                <div class="tool-option-group">
                    <div class="tool-option-item">
                        <label>Page Range (e.g. 1-3, 5)</label>
                        <input type="text" id="split-range" class="form-input" placeholder="Leave empty for all pages">
                    </div>
                    <p class="text-sm text-muted">Tip: If splitting all pages, you'll get a ZIP file.</p>
                </div>
            `;
        } else if (tool === 'compress') {
            optionsContainer.innerHTML = `
                <div class="tool-option-group">
                    <div class="tool-option-item">
                        <label>Optimization Level</label>
                        <select id="opt-level" class="form-input">
                            <option value="extreme">Extreme (Smallest)</option>
                            <option value="recommended" selected>Recommended</option>
                            <option value="low">Low (Best quality)</option>
                        </select>
                    </div>
                    <div class="checkbox-group">
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-grayscale">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Grayscale</span>
                                <span class="checkbox-desc">Remove colors to save space</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-strip" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Strip Metadata</span>
                                <span class="checkbox-desc">Remove hidden info and annotations</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-flatten">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Flatten Forms</span>
                                <span class="checkbox-desc">Turn forms into permanent text</span>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        }
    },

    handleFiles(files) {
        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');

        if (pdfFiles.length === 0) return;

        if (this.currentTool === 'merge') {
            this.selectedFiles = [...this.selectedFiles, ...pdfFiles];
        } else {
            this.selectedFiles = pdfFiles.slice(0, 1);
        }

        this.updateUI();
    },

    updateUI() {
        const fileListContainer = document.getElementById('file-list-container');
        const fileList = document.getElementById('file-list');
        const actionContainer = document.getElementById('action-container');
        const fileCountSpan = document.getElementById('file-count');
        const totalSizeSpan = document.getElementById('total-size');
        const reorderHint = document.querySelector('.reorder-hint');
        const emptyState = document.getElementById('empty-state');

        if (reorderHint) {
            reorderHint.style.display = this.currentTool === 'merge' && this.selectedFiles.length > 1 ? 'block' : 'none';
        }

        fileCountSpan.textContent = this.selectedFiles.length;

        let totalSize = 0;
        fileList.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            totalSize += file.size;
            const li = document.createElement('li');
            li.className = 'file-item';

            // Only allow dragging for merge tool
            if (this.currentTool === 'merge') {
                li.draggable = true;
            } else {
                li.draggable = false;
            }
            li.dataset.index = index;

            li.innerHTML = `
                ${this.currentTool === 'merge' ? `
                <div class="file-drag-handle">
                    <i data-lucide="grip-vertical"></i>
                </div>` : ''}
                <i data-lucide="file" class="file-icon"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-meta">${this.formatFileSize(file.size)}</span>
                </div>
                <button class="btn-remove" onclick="app.removeFile(${index}); event.stopPropagation();">
                    <i data-lucide="x"></i>
                </button>
            `;

            if (this.currentTool === 'merge') {
                li.addEventListener('dragstart', (e) => {
                    li.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', index);
                });

                li.addEventListener('dragend', () => li.classList.remove('dragging'));

                li.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const draggingItem = document.querySelector('.dragging');
                    const siblings = [...fileList.querySelectorAll('.file-item:not(.dragging)')];
                    let nextSibling = siblings.find(sibling => {
                        return e.clientY <= sibling.getBoundingClientRect().top + sibling.getBoundingClientRect().height / 2;
                    });
                    fileList.insertBefore(draggingItem, nextSibling);
                });

                li.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const oldIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    const newIndex = [...fileList.querySelectorAll('.file-item')].indexOf(li);

                    // Update the array
                    const [movedFile] = this.selectedFiles.splice(oldIndex, 1);
                    this.selectedFiles.splice(newIndex, 0, movedFile);
                    this.updateUI();
                });
            }

            fileList.appendChild(li);
        });

        totalSizeSpan.textContent = this.formatFileSize(totalSize);

        if (this.selectedFiles.length > 0) {
            fileListContainer.classList.remove('hidden');
            actionContainer.classList.remove('hidden');
            emptyState.classList.add('hidden');
        } else {
            fileListContainer.classList.add('hidden');
            actionContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }

        lucide.createIcons();
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateUI();
    },

    clearFiles() {
        this.selectedFiles = [];
        this.resetFileInput();
        this.updateUI();
        this.hideOverlays();
    },

    resetFileInput() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
    },

    hideOverlays() {
        document.getElementById('view-processing').classList.add('hidden');
        document.getElementById('view-success').classList.add('hidden');
    },

    async process() {
        if (this.selectedFiles.length === 0) return;

        // Show processing overlay
        document.getElementById('view-processing').classList.remove('hidden');
        document.getElementById('view-success').classList.add('hidden');

        try {
            let resultBlob;
            let fileName = 'processed.pdf';

            if (this.currentTool === 'merge') {
                const options = {
                    toc: document.getElementById('opt-toc')?.checked,
                    filename: document.getElementById('opt-filename')?.checked,
                    origPages: document.getElementById('opt-orig-pages')?.checked,
                    finalPages: document.getElementById('opt-final-pages')?.checked
                };
                resultBlob = await PDFTools.merge(this.selectedFiles, options);
                fileName = 'merged_document.pdf';
            }
            else if (this.currentTool === 'split') {
                const range = document.getElementById('split-range')?.value;
                const results = await PDFTools.split(this.selectedFiles[0], range);

                // If multiple pages and no specific range, create a ZIP
                if (results.length > 1) {
                    resultBlob = await this.createZipFromBlobs(results, this.selectedFiles[0].name);
                    fileName = `split_pages_${this.selectedFiles[0].name.replace('.pdf', '')}.zip`;
                } else {
                    resultBlob = results[0];
                    fileName = `split_${this.selectedFiles[0].name}`;
                }
            }
            else if (this.currentTool === 'compress') {
                const options = {
                    level: document.getElementById('opt-level')?.value || 'recommended',
                    grayscale: document.getElementById('opt-grayscale')?.checked,
                    strip: document.getElementById('opt-strip')?.checked,
                    flatten: document.getElementById('opt-flatten')?.checked
                };
                resultBlob = await PDFTools.compress(this.selectedFiles[0], options);
                fileName = `compressed_${this.selectedFiles[0].name}`;
            }

            this.showSuccess(resultBlob, fileName);
        } catch (error) {
            console.error('Processing error:', error);
            alert('An error occurred while processing the PDF. Please try again.');
            this.hideOverlays();
        }
    },

    async createZipFromBlobs(blobs, originalFileName) {
        try {
            if (typeof JSZip !== 'undefined') {
                const zip = new JSZip();
                const baseName = originalFileName.replace('.pdf', '');
                blobs.forEach((blob, i) => {
                    zip.file(`${baseName}_page_${i + 1}.pdf`, blob);
                });
                return await zip.generateAsync({ type: 'blob' });
            }
        } catch (e) {
            console.warn('JSZip not available, falling back to single file');
        }

        // Fallback: merge all split pages back into one PDF
        const { PDFDocument } = PDFLib;
        const mergedPdf = await PDFDocument.create();

        for (const blob of blobs) {
            const arrayBuffer = await blob.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    showSuccess(blob, fileName) {
        // Store blob and filename for download button
        this.downloadBlob = blob;
        this.downloadFileName = fileName;

        const downloadLink = document.getElementById('download-link');

        // Remove old event listener if exists
        const newDownloadLink = downloadLink.cloneNode(true);
        downloadLink.parentNode.replaceChild(newDownloadLink, downloadLink);

        // Add click handler for direct download
        newDownloadLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.triggerDownload();
        });

        // Update success view based on file type
        const successTitle = document.querySelector('#view-success h2');
        const successDesc = document.querySelector('#view-success p');

        if (fileName.endsWith('.zip')) {
            successTitle.textContent = 'Split Complete!';
            successDesc.textContent = 'Your ZIP file with all split pages is ready.';
        } else {
            successTitle.textContent = 'Task Completed!';
            successDesc.textContent = 'Your processed file is ready for download.';
        }

        // Show success overlay
        document.getElementById('view-processing').classList.add('hidden');
        document.getElementById('view-success').classList.remove('hidden');

        lucide.createIcons();
    },

    triggerDownload() {
        if (!this.downloadBlob || !this.downloadFileName) {
            console.error('No file to download');
            return;
        }

        const url = URL.createObjectURL(this.downloadBlob);
        const tempLink = document.createElement('a');
        tempLink.href = url;
        tempLink.download = this.downloadFileName;
        tempLink.style.display = 'none';
        document.body.appendChild(tempLink);
        tempLink.click();

        setTimeout(() => {
            document.body.removeChild(tempLink);
            URL.revokeObjectURL(url);
        }, 100);
    },

    resetToDefault() {
        this.clearFiles();
        this.downloadBlob = null;
        this.downloadFileName = null;
        this.hideOverlays();
    }
};

// Start app
window.addEventListener('DOMContentLoaded', () => app.init());
