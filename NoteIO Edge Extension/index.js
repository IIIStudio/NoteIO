// Dropbox应用配置
let DROPBOX_CONFIG = {
    clientId: localStorage.getItem('dropbox-client-id') || '',
    clientSecret: localStorage.getItem('dropbox-client-secret') || '',
    redirectUri: 'https://localhost/'
};

// 全局变量
let globalPasteHandler = null;
let currentNote = null;
let currentPageId = null;
let notesData = {};
let isEditingTabName = false;
let isSidebarVisible = true;
let dropboxAccessToken = localStorage.getItem('dropbox-access-token');
let dropboxRefreshToken = localStorage.getItem('dropbox-refresh-token');

// 检测是否为移动设备
function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const pageTabs = document.getElementById('pageTabs');
    const addPageBtn = document.getElementById('addPage');
    const aside = document.querySelector('.aside');
    const contextMenu = document.getElementById('contextMenu');
    const copyBtn = document.getElementById('copyNote');
    const pinBtn = document.getElementById('pinNote');
    const deleteBtn = document.getElementById('deleteNote');
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const downloadBtn = document.getElementById('downloadBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const dropboxBtn = document.getElementById('dropboxBtn');
    const jgyBtn = document.getElementById('jgyBtn');
    const configBtn = document.getElementById('configBtn');
    const fileInput = document.getElementById('fileInput');
    const statusToast = document.getElementById('statusToast');
    const authModal = document.getElementById('authModal');
    const clientIdInput = document.getElementById('clientIdInput');
    const clientSecretInput = document.getElementById('clientSecretInput');
    const saveAuthConfigBtn = document.getElementById('saveAuthConfig');
    const closeAuthModalBtn = document.getElementById('closeAuthModal');
    const authCodeInput = document.getElementById('authCodeInput');
    const submitAuthCode = document.getElementById('submitAuthCode');
    const downloadFromDropbox = document.getElementById('downloadFromDropbox');
    const uploadToDropboxBtn = document.getElementById('uploadToDropboxBtn');

    // 坚果云(WebDAV) 相关DOM
    const jgyModal = document.getElementById('jgyModal');
    const jgyServerInput = document.getElementById('jgyServerInput');
    const jgyUserInput = document.getElementById('jgyUserInput');
    const jgyPassInput = document.getElementById('jgyPassInput');
    const jgyDirInput = document.getElementById('jgyDirInput');
    const jgyProxyInput = document.getElementById('jgyProxyInput');
    const saveJGYConfigBtn = document.getElementById('saveJGYConfig');
    const closeJGYModalBtn = document.getElementById('closeJGYModal');
    const downloadFromJGY = document.getElementById('downloadFromJGY');
    const uploadToJGYBtn = document.getElementById('uploadToJGYBtn');

    // 初始化配置输入框
    clientIdInput.value = DROPBOX_CONFIG.clientId;
    clientSecretInput.value = DROPBOX_CONFIG.clientSecret;

    // 坚果云(WebDAV) 配置
    let JGY_CONFIG = {
      server: localStorage.getItem('jgy-server') || 'https://dav.jianguoyun.com/dav/',
      user: localStorage.getItem('jgy-user') || '',
      pass: localStorage.getItem('jgy-pass') || '',
      dir: localStorage.getItem('jgy-dir') || 'NoteIO',
      proxy: localStorage.getItem('jgy-proxy') || ''
    };
    // 初始化JGY输入框默认值
    jgyServerInput.value = JGY_CONFIG.server;
    jgyUserInput.value = JGY_CONFIG.user;
    jgyPassInput.value = JGY_CONFIG.pass;
    jgyDirInput.value = JGY_CONFIG.dir;
    if (jgyProxyInput) jgyProxyInput.value = JGY_CONFIG.proxy;

    // 首先检查URL中是否有授权码
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    
    if (authCode) {
        // 自动显示设置模态框并填充授权码
        showAuthModal();
        authCodeInput.value = authCode;
        showStatus('检测到授权码，请点击提交完成认证', 5000);
        
        // 清除URL中的code参数，避免刷新后重复处理
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }

    // 加载数据
    loadData();
    
    if (Object.keys(notesData).length === 0) {
        const firstPageId = 'page-' + Date.now();
        notesData[firstPageId] = {
            id: firstPageId,
            name: '默认页签',
            notes: []
        };
        saveData();
    }
    
    renderAllPageTabs();

    // Dropbox按钮点击事件 - 开始认证流程
    dropboxBtn.addEventListener('click', function() {
        if (!DROPBOX_CONFIG.clientId || !DROPBOX_CONFIG.clientSecret) {
            showAuthModal();
            showStatus('请先配置Dropbox API信息');
            return;
        }
        
        if (dropboxAccessToken) {
            showAuthModal();
        } else {
            authenticateDropbox();
        }
    });

    function showStatus(message, duration = 3000) {
        statusToast.textContent = message;
        statusToast.classList.add('show');
        setTimeout(() => { statusToast.classList.remove('show'); }, duration);
    }

    function showAuthModal() { authModal.style.display = 'flex'; }
    function hideAuthModal() { authModal.style.display = 'none'; }

    saveAuthConfigBtn.addEventListener('click', function() {
        DROPBOX_CONFIG.clientId = clientIdInput.value.trim();
        DROPBOX_CONFIG.clientSecret = clientSecretInput.value.trim();
        localStorage.setItem('dropbox-client-id', DROPBOX_CONFIG.clientId);
        localStorage.setItem('dropbox-client-secret', DROPBOX_CONFIG.clientSecret);
        showStatus('Dropbox配置已保存');
        authenticateDropbox();
    });

    submitAuthCode.addEventListener('click', function() {
        const authCode = authCodeInput.value.trim();
        if (!authCode) { showStatus('请输入授权码'); return; }
        if (!DROPBOX_CONFIG.clientId || !DROPBOX_CONFIG.clientSecret) {
            showStatus('请先配置Dropbox API信息'); return;
        }
        exchangeCodeForToken(authCode);
    });

    downloadFromDropbox.addEventListener('click', function() {
        if (!dropboxAccessToken) { showStatus('请先进行Dropbox认证'); return; }
        downloadFromDropboxAction();
    });

    uploadToDropboxBtn.addEventListener('click', function() {
        if (!dropboxAccessToken) { showStatus('请先进行Dropbox认证'); return; }
        uploadToDropbox();
    });

    closeAuthModalBtn.addEventListener('click', hideAuthModal);
    authModal.addEventListener('click', function(e) { if (e.target === authModal) hideAuthModal(); });

    // 坚果云模态框打开/关闭
    function showJGYModal() { jgyModal.style.display = 'flex'; }
    function hideJGYModal() { jgyModal.style.display = 'none'; }
    closeJGYModalBtn.addEventListener('click', hideJGYModal);
    jgyModal.addEventListener('click', function(e){ if (e.target === jgyModal) hideJGYModal(); });

    jgyBtn.addEventListener('click', function() { showJGYModal(); });

    // 保存坚果云配置
    saveJGYConfigBtn.addEventListener('click', function() {
      JGY_CONFIG.server = jgyServerInput.value.trim() || 'https://dav.jianguoyun.com/dav/';
      JGY_CONFIG.user = jgyUserInput.value.trim();
      JGY_CONFIG.pass = jgyPassInput.value.trim();
      JGY_CONFIG.dir = jgyDirInput.value.trim() || 'NoteIO';
      JGY_CONFIG.proxy = (jgyProxyInput && jgyProxyInput.value.trim()) || '';
      localStorage.setItem('jgy-server', JGY_CONFIG.server);
      localStorage.setItem('jgy-user', JGY_CONFIG.user);
      localStorage.setItem('jgy-pass', JGY_CONFIG.pass);
      localStorage.setItem('jgy-dir', JGY_CONFIG.dir);
      localStorage.setItem('jgy-proxy', JGY_CONFIG.proxy);
      showStatus('坚果云配置已保存');
    });

    // WebDAV 基础工具
    function buildJGYUrl(fileName) {
      let base = JGY_CONFIG.server;
      if (!base.endsWith('/')) base += '/';
      let dir = JGY_CONFIG.dir || '';
      if (dir.startsWith('/')) dir = dir.slice(1);
      if (dir.endsWith('/')) dir = dir.slice(0, -1);
      const target = base + (dir ? (dir + '/') : '') + fileName;
      const proxy = JGY_CONFIG.proxy;
      if (proxy) {
        if (proxy.includes('{url}')) return proxy.replace('{url}', target);
        return proxy + (proxy.endsWith('/') ? '' : '/') + target;
      }
      return target;
    }
    function buildBasicAuthHeader(user, pass) {
      const token = btoa(unescape(encodeURIComponent(user + ':' + pass)));
      return 'Basic ' + token;
    }

    // 从坚果云下载
    downloadFromJGY.addEventListener('click', async function() {
      if (!JGY_CONFIG.user || !JGY_CONFIG.pass) { showStatus('请先填写坚果云账户与密码'); return; }
      const url = buildJGYUrl('NoteIO.json');
      try {
        showStatus('正在从坚果云下载...', 5000);
        const res = await fetch(url, { method: 'GET', headers: { 'Authorization': buildBasicAuthHeader(JGY_CONFIG.user, JGY_CONFIG.pass) } });
        if (res.ok) {
          const text = await res.text();
          const data = JSON.parse(text);
          notesData = data;
          saveData();
          renderAllPageTabs();
          showStatus('已成功从坚果云下载！');
        } else if (res.status === 404) {
          showStatus('坚果云上未找到 NoteIO.json');
        } else {
          const errText = await res.text();
          console.error('坚果云下载错误:', errText);
          showStatus('下载失败: ' + res.status + ' ' + res.statusText);
        }
      } catch (e) {
        console.error('坚果云下载异常:', e);
        showStatus('下载失败: ' + e.message);
      }
    });

    // 上传到坚果云
    uploadToJGYBtn.addEventListener('click', async function() {
      if (!JGY_CONFIG.user || !JGY_CONFIG.pass) { showStatus('请先填写坚果云账户与密码'); return; }
      const url = buildJGYUrl('NoteIO.json');
      try {
        showStatus('正在上传到坚果云...', 5000);
        const dataStr = JSON.stringify(notesData, null, 2);
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': buildBasicAuthHeader(JGY_CONFIG.user, JGY_CONFIG.pass),
            'Content-Type': 'application/json'
          },
          body: dataStr
        });
        if (res.ok || res.status === 201 || res.status === 204) {
          showStatus('已成功上传到坚果云！');
        } else {
          const errText = await res.text();
          console.error('坚果云上传错误:', errText);
          showStatus('上传失败: ' + res.status + ' ' + res.statusText);
        }
      } catch (e) {
        console.error('坚果云上传异常:', e);
        showStatus('上传失败: ' + e.message);
      }
    });

    // 阻止模态框内的输入框触发全局粘贴事件
    const authInputs = [clientIdInput, clientSecretInput, authCodeInput, jgyServerInput, jgyUserInput, jgyPassInput, jgyDirInput, jgyProxyInput].filter(Boolean);
    authInputs.forEach(input => {
        input.addEventListener('paste', e => e.stopPropagation());
        input.addEventListener('click', e => e.stopPropagation());
    });

    // 加载数据时同时加载侧边栏状态
    function loadData() {
        const savedData = localStorage.getItem('smart-notes-data');
        if (savedData) notesData = JSON.parse(savedData);
        const sidebarState = localStorage.getItem('smart-notes-sidebar-state');
        if (sidebarState === 'hidden') {
            isSidebarVisible = false;
            sidebar.classList.add('hidden');
            mainContent.style.marginLeft = '0px';
            toggleSidebarBtn.textContent = '›';
        }
        const savedPageId = localStorage.getItem('smart-notes-current-page');
        if (savedPageId && notesData[savedPageId]) currentPageId = savedPageId;
    }

    toggleSidebarBtn.addEventListener('click', function() {
        isSidebarVisible = !isSidebarVisible;
        if (isSidebarVisible) {
            sidebar.classList.remove('hidden');
            mainContent.style.marginLeft = '0';
            toggleSidebarBtn.textContent = '≡';
            localStorage.setItem('smart-notes-sidebar-state', 'visible');
        } else {
            sidebar.classList.add('hidden');
            mainContent.style.marginLeft = '0px';
            toggleSidebarBtn.textContent = '›';
            localStorage.setItem('smart-notes-sidebar-state', 'hidden');
        }
    });

    downloadBtn.addEventListener('click', function() {
        const currentDate = formatDate(new Date(), 'YYYY年MM月DD日');
        const fileName = `笔记-${currentDate}.json`;
        const dataStr = JSON.stringify(notesData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(dataBlob);
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });

    uploadBtn.addEventListener('click', function() { fileInput.click(); });

    function authenticateDropbox() {
        const csrfToken = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('dropbox-csrf-token', csrfToken);
        const authUrl = 'https://www.dropbox.com/oauth2/authorize'
            + '?client_id=' + DROPBOX_CONFIG.clientId
            + '&redirect_uri=' + encodeURIComponent(DROPBOX_CONFIG.redirectUri)
            + '&response_type=code'
            + '&state=' + csrfToken
            + '&token_access_type=offline';
        window.open(authUrl, '_blank', 'width=600,height=600');
        showStatus('请在新窗口中完成Dropbox认证');
    }

    async function exchangeCodeForToken(code) {
        showStatus('正在获取访问令牌...', 5000);
        try {
            const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code, grant_type: 'authorization_code',
                    client_id: DROPBOX_CONFIG.clientId,
                    client_secret: DROPBOX_CONFIG.clientSecret,
                    redirect_uri: DROPBOX_CONFIG.redirectUri
                })
            });
            if (response.ok) {
                const data = await response.json();
                dropboxAccessToken = data.access_token;
                dropboxRefreshToken = data.refresh_token;
                localStorage.setItem('dropbox-access-token', dropboxAccessToken);
                localStorage.setItem('dropbox-refresh-token', dropboxRefreshToken);
                showStatus('Dropbox认证成功！');
                hideAuthModal();
            } else {
                const error = await response.text();
                console.error('Dropbox令牌交换错误:', error);
                showStatus('认证失败，请检查配置信息');
            }
        } catch (error) {
            console.error('Dropbox令牌交换异常:', error);
            showStatus('网络错误，请重试');
        }
    }

    async function uploadToDropbox() {
        if (!dropboxAccessToken) { showStatus('请先进行Dropbox认证'); return; }
        try {
            showStatus('正在上传到Dropbox...', 5000);
            const fileName = `NoteIO.json`;
            const dataStr = JSON.stringify(notesData, null, 2);
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + dropboxAccessToken,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: '/' + fileName,
                        mode: 'overwrite',
                        autorename: true,
                        mute: false
                    })
                },
                body: dataStr
            });
            if (response.ok) {
                showStatus('已成功上传到Dropbox！');
            } else {
                const error = await response.json();
                console.error('Dropbox上传错误:', error);
                showStatus('上传失败: ' + (error.error_summary || '未知错误'));
                if (response.status === 401) {
                    localStorage.removeItem('dropbox-access-token');
                    dropboxAccessToken = null;
                }
            }
        } catch (error) {
            console.error('Dropbox上传异常:', error);
            showStatus('上传失败: ' + error.message);
        }
    }

    async function downloadFromDropboxAction() {
        if (!dropboxAccessToken) { showStatus('请先进行Dropbox认证'); return; }
        try {
            showStatus('正在从Dropbox下载...', 5000);
            const fileName = `NoteIO.json`;
            const response = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + dropboxAccessToken,
                    'Dropbox-API-Arg': JSON.stringify({ path: '/' + fileName })
                }
            });
            if (response.ok) {
                const data = await response.json();
                notesData = data;
                saveData();
                renderAllPageTabs();
                showStatus('已成功从Dropbox下载！');
            } else {
                if (response.status === 409) {
                    showStatus('Dropbox上未找到NoteIO.json文件');
                } else {
                    const error = await response.json();
                    console.error('Dropbox下载错误:', error);
                    showStatus('下载失败: ' + (error.error_summary || '未知错误'));
                    if (response.status === 401) {
                        localStorage.removeItem('dropbox-access-token');
                        dropboxAccessToken = null;
                    }
                }
            }
        } catch (error) {
            console.error('Dropbox下载异常:', error);
            showStatus('下载失败: ' + error.message);
        }
    }

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (confirm('确定要导入此文件吗？这将覆盖当前所有笔记。')) {
                    notesData = importedData;
                    saveData();
                    renderAllPageTabs();
                    fileInput.value = '';
                }
            } catch (error) {
                alert('文件格式不正确，导入失败');
                console.error(error);
            }
        };
        reader.readAsText(file);
    });

    function formatDate(date, format) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
    }
    
    addPageBtn.addEventListener('click', function() {
        const pageId = 'page-' + Date.now();
        const pageName = '新页签';
        notesData[pageId] = { id: pageId, name: pageName, notes: [] };
        saveData();
        renderAllPageTabs();
        switchPage(pageId);
        const newTab = document.querySelector(`.page-tab[data-id="${pageId}"]`);
        if (newTab) { editPageTabName(newTab); }
    });
    
    function renderAllPageTabs() {
        pageTabs.innerHTML = '';
        for (const pageId in notesData) {
            if (notesData.hasOwnProperty(pageId)) {
                addPageTabToDOM(pageId, notesData[pageId].name);
            }
        }
        if (currentPageId && notesData[currentPageId]) {
            switchPage(currentPageId);
        } else if (Object.keys(notesData).length > 0) {
            const firstPageId = Object.keys(notesData)[0];
            switchPage(firstPageId);
        }
    }
    
    function addPageTabToDOM(pageId, pageName) {
        const pageTab = document.createElement('div');
        pageTab.className = 'page-tab';
        pageTab.dataset.id = pageId;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'page-tab-name';
        nameSpan.textContent = pageName;
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'page-tab-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = '删除页签';
        pageTab.appendChild(nameSpan);
        pageTab.appendChild(deleteBtn);
        pageTab.addEventListener('click', function(e) {
            if (isEditingTabName || e.target === deleteBtn) return;
            if (e.detail === 2 || isMobileDevice()) {
                editPageTabName(pageTab);
            } else if (e.detail === 1) {
                switchPage(pageId);
            }
        });
        nameSpan.addEventListener('dblclick', function(e) {
            if (isEditingTabName) return;
            e.stopPropagation();
            editPageTabName(pageTab);
        });
        let pressTimer;
        nameSpan.addEventListener('touchstart', function(e) {
            if (isEditingTabName) return;
            e.stopPropagation();
            pressTimer = setTimeout(function() { editPageTabName(pageTab); }, 500);
        });
        nameSpan.addEventListener('touchend', function(e) {
            e.stopPropagation();
            clearTimeout(pressTimer);
        });
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deletePage(pageId);
        });
        pageTabs.appendChild(pageTab);
        return pageTab;
    }
    
    function editPageTabName(pageTab) {
        if (isEditingTabName) return;
        isEditingTabName = true;
        const pageId = pageTab.dataset.id;
        const nameSpan = pageTab.querySelector('.page-tab-name');
        const oldName = nameSpan.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'page-tab-input';
        input.value = oldName;
        nameSpan.style.display = 'none';
        pageTab.insertBefore(input, nameSpan);
        input.focus();
        if (isMobileDevice()) input.setAttribute('inputmode', 'text');
        function saveName() {
            isEditingTabName = false;
            const newName = input.value.trim() || '未命名页签';
            notesData[pageId].name = newName;
            saveData();
            nameSpan.textContent = newName;
            nameSpan.style.display = '';
            pageTab.removeChild(input);
        }
        function cancelEdit() {
            isEditingTabName = false;
            nameSpan.style.display = '';
            pageTab.removeChild(input);
        }
        input.addEventListener('blur', saveName);
        input.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') { saveName(); }
            else if (e.key === 'Escape') { cancelEdit(); }
        });
    }
    
    function deletePage(pageId) {
        if (Object.keys(notesData).length <= 1) {
            alert('至少需要保留一个页签'); return;
        }
        if (confirm('确定要删除这个页签及其所有内容吗？')) {
            delete notesData[pageId];
            saveData();
            if (currentPageId === pageId) {
                const remainingPageId = Object.keys(notesData)[0];
                switchPage(remainingPageId);
            }
            renderAllPageTabs();
        }
    }
    
    function switchPage(pageId) {
        document.querySelectorAll('.page-tab').forEach(tab => { tab.classList.remove('active'); });
        const activeTab = document.querySelector(`.page-tab[data-id="${pageId}"]`);
        if (activeTab) activeTab.classList.add('active');
        currentPageId = pageId;
        localStorage.setItem('smart-notes-current-page', currentPageId);
        renderNotes();
    }
    
    function renderNotes() {
        aside.innerHTML = '';
        const currentPage = notesData[currentPageId];
        if (!currentPage || currentPage.notes.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = '粘贴内容创建第一个笔记 (Ctrl+V) 支持右键复制或删除 纯本地支持下载与上传';
            aside.appendChild(emptyMsg);
            return;
        }
        const pinnedNotes = currentPage.notes.filter(note => note.pinned);
        pinnedNotes.forEach(noteData => { createNote(noteData.content, noteData.id, noteData.date, noteData.pinned); });
        const normalNotes = currentPage.notes.filter(note => !note.pinned);
        normalNotes.forEach(noteData => { createNote(noteData.content, noteData.id, noteData.date, noteData.pinned); });
    }
    
    function handlePaste(e) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.classList.contains('note-container')) {
            const noteId = activeElement.closest('.note').dataset.id;
            setTimeout(() => { updateNoteContent(noteId, getNoteContent(activeElement)); }, 0);
            return;
        }
        e.preventDefault();
        let text = (e.clipboardData || window.clipboardData).getData('text/plain');
        text = text.trim();
        if (text) {
            const emptyMsg = document.querySelector('.empty-message');
            if (emptyMsg) emptyMsg.remove();
            createNote(text);
        }
    }
    document.pasteHandler = handlePaste;
    document.addEventListener('paste', document.pasteHandler);
    
    function createNote(content = '', noteId = null, noteDate = null, pinned = false) {
        noteId = noteId || 'note-' + Date.now();
        const currentDate = noteDate || formatDate(new Date(), 'YYYY年MM月DD日');
        const newNote = document.createElement('div');
        newNote.className = 'note' + (pinned ? ' pinned' : '');
        newNote.dataset.id = noteId;
        newNote.innerHTML = `
            <div class="note-container" contenteditable="true">${formatContentForDisplay(content)}</div>
            <div class="note-bottom">
                <span class="note-date">${currentDate}</span>
            </div>
            ${pinned ? '<div class="pin-icon" title="取消置顶"></div>' : ''}
        `;
        aside.appendChild(newNote);
        const container = newNote.querySelector('.note-container');
        focusNote(container);
        container.addEventListener('input', function() { updateNoteContent(noteId, getNoteContent(container)); });
        if (pinned) {
            const pinIcon = newNote.querySelector('.pin-icon');
            pinIcon.addEventListener('click', function(e) { e.stopPropagation(); togglePinNote(noteId); });
            pinIcon.addEventListener('touchstart', function(e) { e.stopPropagation(); togglePinNote(noteId); });
        }
        newNote.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            currentNote = newNote;
            showContextMenu(e.clientX, e.clientY);
        });
        let touchTimer;
        newNote.addEventListener('touchstart', function(e) {
            currentNote = newNote;
            touchTimer = setTimeout(function() { showContextMenu(e.touches[0].clientX, e.touches[0].clientY); }, 500);
        });
        newNote.addEventListener('touchend', function() { clearTimeout(touchTimer); });
        newNote.addEventListener('touchmove', function() { clearTimeout(touchTimer); });
        if (!noteExistsInData(noteId)) {
            notesData[currentPageId].notes.push({ id: noteId, content: content, date: currentDate, pinned: pinned });
            saveData();
        }
        return newNote;
    }
    
    function noteExistsInData(noteId) { return notesData[currentPageId].notes.some(note => note.id === noteId); }
    function updateNoteContent(noteId, content) {
        const noteIndex = notesData[currentPageId].notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) { notesData[currentPageId].notes[noteIndex].content = content; saveData(); }
    }
    function formatContentForDisplay(content) { return content }
    function getNoteContent(container) {
        let html = container.innerHTML;
        html = html.replace(/<br\s*\/?>/gi, '\n');
        html = html.replace(/<\/div>/gi, '\n');
        html = html.replace(/<\/p>/gi, '\n');
        html = html.replace(/<p>/gi, '');
        html = html.replace(/　　/g, '');
        const div = document.createElement('div');
        div.innerHTML = html;
        let text = div.textContent || div.innerText || '';
        text = text.replace(/\n+/g, '\n');
        return text.trim();
    }
    function focusNote(container) {
        setTimeout(() => {
            container.focus();
            const range = document.createRange();
            range.selectNodeContents(container);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 0);
    }
    function showContextMenu(x, y) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        const noteId = currentNote.dataset.id;
        const noteIndex = notesData[currentPageId].notes.findIndex(note => note.id === noteId);
        const isPinned = notesData[currentPageId].notes[noteIndex].pinned;
        pinBtn.textContent = isPinned ? '取消置顶' : '置顶';
    }
    function hideContextMenu() { contextMenu.style.display = 'none'; }
    copyBtn.addEventListener('click', function() {
        if (currentNote) {
            const content = getNoteContent(currentNote.querySelector('.note-container'));
            navigator.clipboard.writeText(content);
            hideContextMenu();
        }
    });
    pinBtn.addEventListener('click', function() {
        if (currentNote) { const noteId = currentNote.dataset.id; togglePinNote(noteId); hideContextMenu(); }
    });
    function togglePinNote(noteId) {
        const noteIndex = notesData[currentPageId].notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            notesData[currentPageId].notes[noteIndex].pinned = !notesData[currentPageId].notes[noteIndex].pinned;
            saveData();
            renderNotes();
        }
    }
    deleteBtn.addEventListener('click', function() {
        if (currentNote) {
            const noteId = currentNote.dataset.id;
            currentNote.remove();
            const noteIndex = notesData[currentPageId].notes.findIndex(note => note.id === noteId);
            if (noteIndex !== -1) {
                notesData[currentPageId].notes.splice(noteIndex, 1);
                saveData();
            }
            hideContextMenu();
            if (document.querySelectorAll('.note').length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'empty-message';
                emptyMsg.textContent = '粘贴内容创建第一个笔记 (Ctrl+V) 支持右键复制或删除 纯本地支持下载与上传';
                aside.appendChild(emptyMsg);
            }
        }
    });
    document.addEventListener('click', hideContextMenu);
    document.addEventListener('touchstart', hideContextMenu);
    function saveData() { localStorage.setItem('smart-notes-data', JSON.stringify(notesData)); }
});