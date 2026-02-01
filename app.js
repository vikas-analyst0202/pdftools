/**
 * Main Application logic for PDF Master
 */

const app = {
    currentTool: null,
    selectedFiles: [],
    downloadBlob: null,
    downloadFileName: null,
    draggedIndex: null,
    dropTargetIndex: null,
    deferredPrompt: null, // For PWA install
    progressInterval: null,

    init() {
        this.loadTheme();
        this.bindEvents();

        // Smart Tool Defaults: Load last used tool
        const savedTool = localStorage.getItem('lastTool') || 'merge';
        this.selectTool(savedTool);

        console.log('Analyst PDF Tool Initialized');

        // PWA Install Prompt Listener
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'inline-flex';
                installBtn.classList.remove('hidden');
            }
        });
    },

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let isDark = false;

        // Default is light (has class 'light-mode'). 
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.body.classList.remove('light-mode');
            isDark = true;
        } else {
            document.body.classList.add('light-mode');
        }

        // Reset icon HTML and re-render
        themeToggle.innerHTML = `<i data-lucide="${isDark ? 'moon' : 'sun'}"></i>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    bindEvents() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const processBtn = document.getElementById('process-btn');
        const themeToggle = document.getElementById('theme-toggle');
        const installBtn = document.getElementById('install-btn');

        // File Selection
        fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag and Drop
        dropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', (e) => {
            // Only remove if we really left the element (not just entered a child)
            if (e.target === dropZone) {
                dropZone.classList.remove('dragover');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Click on drop zone to open file dialog
        dropZone.addEventListener('click', (e) => {
            // Prevent click when clicking valid children that shouldn't trigger file input
            if (!e.target.closest('.link-style') && !e.target.closest('input')) {
                fileInput.click();
            }
        });

        // Processing
        processBtn.addEventListener('click', () => this.process());

        // Theme Toggle
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');

            if (isLight) {
                themeToggle.innerHTML = '<i data-lucide="sun"></i>';
                localStorage.setItem('theme', 'light');
            } else {
                themeToggle.innerHTML = '<i data-lucide="moon"></i>';
                localStorage.setItem('theme', 'dark');
            }
            lucide.createIcons();
        });

        // PWA Install Button
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    this.deferredPrompt = null;
                    installBtn.style.display = 'none';
                }
            });
        }
    },

    selectTool(tool) {
        // Update current tool
        this.currentTool = tool;
        localStorage.setItem('lastTool', tool); // Save preference

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

        // Update drop zone text based on tool
        const dropZoneTitle = document.querySelector('.drop-text h4');
        if (dropZoneTitle) {
            if (tool === 'merge') {
                dropZoneTitle.textContent = 'Drop PDF files here';
            } else {
                dropZoneTitle.textContent = 'Drop a PDF file here';
            }
        }

        // Setup tool-specific options in sidebar
        this.setupToolOptions(tool);

        // Clear files when switching to single-file tools if multiple selected
        if (tool !== 'merge' && this.selectedFiles.length > 1) {
            this.selectedFiles = this.selectedFiles.slice(0, 1);
            this.showToast('Kept only the first file for this tool.', 'info');
        }

        this.updateUI(); // Re-render logic handles visibility
        this.hideOverlays();
    },

    setupToolOptions(tool) {
        const optionsContainer = document.getElementById('tool-options');

        if (tool === 'merge') {
            optionsContainer.innerHTML = `
                <div class="tool-option-group">
                    <div class="checkbox-group">
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-toc" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Hyperlinked TOC</span>
                                <span class="checkbox-desc">Add clickable Table of Contents (Page 1)</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-filename" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Source Filename</span>
                                <span class="checkbox-desc">Stamp source filename on every page</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-orig-pages" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Original Page Numbers</span>
                                <span class="checkbox-desc">Retain original paging (e.g., "1/56")</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-final-pages" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Final Page Numbers</span>
                                <span class="checkbox-desc">Add sequential numbering to combined doc</span>
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
                    <p class="text-sm text-muted" style="margin-bottom: 1rem;">Select what to remove to reduce file size:</p>
                    <div class="checkbox-group">
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-strip-metadata" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Strip Metadata</span>
                                <span class="checkbox-desc">Remove title, author, keywords, etc.</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-remove-annotations" checked>
                            <div class="checkbox-label">
                                <span class="checkbox-title">Remove Annotations</span>
                                <span class="checkbox-desc">Remove comments, highlights, sticky notes</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-flatten">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Flatten Forms</span>
                                <span class="checkbox-desc">Convert editable forms to static text</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-remove-bookmarks">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Remove Bookmarks</span>
                                <span class="checkbox-desc">Remove outline/navigation bookmarks</span>
                            </div>
                        </label>
                        <label class="checkbox-item">
                            <input type="checkbox" id="opt-remove-attachments">
                            <div class="checkbox-label">
                                <span class="checkbox-title">Remove Embedded Files</span>
                                <span class="checkbox-desc">Remove any attached files inside PDF</span>
                            </div>
                        </label>
                    </div>
                </div>
            `;
        }
    },

    handleFiles(files) {
        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');

        if (pdfFiles.length === 0) {
            this.showToast('Please select PDF files only', 'error');
            return;
        }

        // Initialize display name for new files
        pdfFiles.forEach(f => {
            f.displayName = f.name;
        });

        if (this.currentTool === 'merge') {
            // Merge allows multiple files
            this.selectedFiles = [...this.selectedFiles, ...pdfFiles];
        } else {
            // Split and Compress only allow one file
            if (this.selectedFiles.length > 0 && pdfFiles.length > 0) {
                this.showToast('File replaced. Only one PDF allowed for this tool.', 'info');
            }
            this.selectedFiles = pdfFiles.slice(0, 1);

            if (pdfFiles.length > 1) {
                this.showToast(`Only the first file selected. ${this.currentTool === 'split' ? 'Split' : 'Compress'} works with one PDF at a time.`, 'info');
            }
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
            li.className = 'file-thumb';

            // Only allow dragging for merge tool
            if (this.currentTool === 'merge') {
                li.draggable = true;
            } else {
                li.draggable = false;
            }
            li.dataset.index = index;

            const serialNum = index + 1;
            const displayName = file.displayName || file.name;

            li.innerHTML = `
                <div class="thumb-serial">${serialNum}</div>
                <button class="btn-remove-thumb">
                    <i data-lucide="x"></i>
                </button>
                <div class="thumb-icon">
                    <i data-lucide="file-text"></i>
                </div>
                <div class="thumb-info">
                    <span class="thumb-name" title="${displayName} (Double click to rename)">${displayName}</span>
                    <span class="thumb-size">${this.formatFileSize(file.size)}</span>
                </div>
                ${this.currentTool === 'merge' ? `<div class="thumb-drag-hint"><i data-lucide="grip-vertical"></i></div>` : ''}
            `;

            // Inline Rename Logic
            const nameSpan = li.querySelector('.thumb-name');
            nameSpan.ondblclick = (e) => {
                e.stopPropagation();
                // Replace span with input
                const input = document.createElement('input');
                input.type = 'text';
                input.value = file.displayName || file.name;
                input.className = 'thumb-name-input';

                const saveName = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        file.displayName = newName;
                    }
                    this.updateUI(); // Re-render to show new name and restore element
                };

                input.onblur = saveName;
                input.onkeydown = (ev) => {
                    if (ev.key === 'Enter') {
                        saveName();
                        ev.preventDefault();
                    }
                };

                nameSpan.replaceWith(input);
                input.focus();
                input.select();
            };

            // Remove Button Logic
            const removeBtn = li.querySelector('.btn-remove-thumb');
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.removeFile(index);
            };

            if (this.currentTool === 'merge') {
                li.addEventListener('dragstart', (e) => {
                    this.draggedIndex = index;
                    li.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', index);
                });

                li.addEventListener('dragend', () => {
                    li.classList.remove('dragging');
                    this.clearDropIndicators();
                    this.draggedIndex = null;
                    this.dropTargetIndex = null;
                });

                li.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';

                    if (this.draggedIndex === index) return;

                    const rect = li.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    const isBeforeMiddle = e.clientX < midX;

                    // Determine insert position
                    let insertPos;
                    if (isBeforeMiddle) {
                        insertPos = index; // Insert before this item
                    } else {
                        insertPos = index + 1; // Insert after this item
                    }

                    // Don't show indicator if dropping at same position
                    if (insertPos === this.draggedIndex || insertPos === this.draggedIndex + 1) {
                        this.clearDropIndicators();
                        this.dropTargetIndex = null;
                        return;
                    }

                    this.dropTargetIndex = insertPos;
                    this.showDropIndicator(li, isBeforeMiddle);
                });

                li.addEventListener('dragleave', (e) => {
                    if (!li.contains(e.relatedTarget)) {
                        li.classList.remove('drop-before', 'drop-after');
                    }
                });

                li.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (this.dropTargetIndex !== null && this.draggedIndex !== null) {
                        const oldIndex = this.draggedIndex;
                        let newIndex = this.dropTargetIndex;

                        // Adjust for the removal of the dragged item
                        if (oldIndex < newIndex) {
                            newIndex--;
                        }

                        if (oldIndex !== newIndex) {
                            const [movedFile] = this.selectedFiles.splice(oldIndex, 1);
                            this.selectedFiles.splice(newIndex, 0, movedFile);
                            this.updateUI();
                        }
                    }
                    this.clearDropIndicators();
                });
            }

            fileList.appendChild(li);
        });

        // Add dragover to the file list container for dropping at the end
        if (this.currentTool === 'merge') {
            fileList.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            fileList.addEventListener('drop', (e) => {
                // Only handle if dropped on the list itself, not on a thumb
                if (e.target === fileList || e.target.classList.contains('file-list')) {
                    e.preventDefault();
                    const oldIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    if (!isNaN(oldIndex) && oldIndex >= 0 && oldIndex < this.selectedFiles.length) {
                        const [movedFile] = this.selectedFiles.splice(oldIndex, 1);
                        this.selectedFiles.push(movedFile);
                        this.updateUI();
                    }
                }
            });
        }

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

    clearDropIndicators() {
        document.querySelectorAll('.drop-before, .drop-after, .drop-target').forEach(el => {
            el.classList.remove('drop-before', 'drop-after', 'drop-target');
        });
    },

    showDropIndicator(element, isBefore) {
        this.clearDropIndicators();
        if (isBefore) {
            element.classList.add('drop-before');
        } else {
            element.classList.add('drop-after');
        }
    },

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateUI();
    },

    clearFiles() {
        if (this.selectedFiles.length === 0) return;

        // Backup files for undo
        const backupFiles = [...this.selectedFiles];

        this.selectedFiles = [];
        this.resetFileInput();
        this.updateUI();
        this.hideOverlays();

        // Show undo toast
        this.showToast(
            `Files cleared. <button id="undo-btn" class="toast-action-btn">Undo</button>`,
            'info',
            5000
        );

        // Bind undo action
        setTimeout(() => {
            const undoBtn = document.getElementById('undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => {
                    this.selectedFiles = backupFiles;
                    this.updateUI();
                    // Remove toast using closest logic if valid, or just let it expire
                    const toast = undoBtn.closest('.toast-notification');
                    if (toast) toast.remove();
                });
            }
        }, 50); // Small delay to ensure DOM update
    },

    resetFileInput() {
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
    },

    hideOverlays() {
        document.getElementById('view-processing').classList.add('hidden');
        document.getElementById('view-success').classList.add('hidden');
        if (this.progressInterval) clearInterval(this.progressInterval);
    },

    updateProgressBar(percent) {
        const bar = document.getElementById('processing-bar');
        if (bar) {
            bar.style.width = `${percent}%`;
        }
    },

    async process() {
        if (this.selectedFiles.length === 0) return;

        // Show processing overlay
        document.getElementById('view-processing').classList.remove('hidden');
        document.getElementById('view-success').classList.add('hidden');
        this.updateProgressBar(0);

        // Simulate progress
        let progress = 0;
        this.progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                this.updateProgressBar(progress);
            }
        }, 200);

        try {
            let resultBlob;
            let fileName = 'processed.pdf';
            const firstFile = this.selectedFiles[0];
            const firstFileName = firstFile.displayName || firstFile.name; // Use displayName if available

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
                const results = await PDFTools.split(firstFile, range);

                // If multiple pages and no specific range, create a ZIP
                if (results.length > 1) {
                    resultBlob = await this.createZipFromBlobs(results, firstFileName);
                    fileName = `split_pages_${firstFileName.replace('.pdf', '')}.zip`;
                } else {
                    resultBlob = results[0];
                    fileName = `split_${firstFileName}`;
                }
            }
            else if (this.currentTool === 'compress') {
                const originalSize = firstFile.size;
                const options = {
                    stripMetadata: document.getElementById('opt-strip-metadata')?.checked,
                    removeAnnotations: document.getElementById('opt-remove-annotations')?.checked,
                    flatten: document.getElementById('opt-flatten')?.checked,
                    removeBookmarks: document.getElementById('opt-remove-bookmarks')?.checked,
                    removeAttachments: document.getElementById('opt-remove-attachments')?.checked
                };
                resultBlob = await PDFTools.compress(firstFile, options);
                fileName = `compressed_${firstFileName}`;

                // Calculate size reduction
                const newSize = resultBlob.size; // Note: resultBlob.size is reliable for Blobs
                const reduction = originalSize > 0 ? ((originalSize - newSize) / originalSize * 100).toFixed(1) : 0;
                const savedBytes = this.formatFileSize(originalSize - newSize);

                // Finish progress
                clearInterval(this.progressInterval);
                this.updateProgressBar(100);

                // Show success with size info
                setTimeout(() => {
                    this.showSuccess(resultBlob, fileName);
                    if (newSize < originalSize) {
                        this.showToast(`📉 Reduced by ${reduction}% (saved ${savedBytes})`, 'success');
                    } else {
                        this.showToast(`File optimized. Size: ${this.formatFileSize(newSize)}`, 'info');
                    }
                }, 500); // Small delay to see 100% bar
                return; // Don't call showSuccess again
            }

            clearInterval(this.progressInterval);
            this.updateProgressBar(100);

            setTimeout(() => {
                this.showSuccess(resultBlob, fileName);
            }, 500);

        } catch (error) {
            console.error('Processing error:', error);
            clearInterval(this.progressInterval);
            alert('An error occurred while processing the PDF. Please try again.');
            this.hideOverlays();
        }
    },

    async createZipFromBlobs(blobs, originalFileName) {
        try {
            if (typeof JSZip !== 'undefined') {
                const zip = new JSZip();
                const baseName = originalFileName.replace(/\.pdf$/i, ''); // Case insensitive replace
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
        // Hide processing overlay
        document.getElementById('view-processing').classList.add('hidden');
        document.getElementById('view-success').classList.remove('hidden'); // Ensure success view is shown

        // Store blob and filename
        this.downloadBlob = blob;
        this.downloadFileName = fileName;

        // Auto-download the file
        this.triggerDownload();

        // Show success toast notification
        this.showToast(`✓ ${fileName} downloaded successfully!`, 'success');
    },

    showToast(message, type = 'info', duration = 4000) {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i data-lucide="x"></i>
            </button>
        `;

        document.body.appendChild(toast);
        lucide.createIcons();

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('toast-fade-out');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
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
