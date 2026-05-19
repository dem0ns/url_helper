// 工具函数
function isJsonString(str) {
    try {
        const obj = JSON.parse(str);
        return typeof obj === 'object' && obj !== null;
    } catch (e) {
        return false;
    }
}

function formatJson(str) {
    try {
        return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
        return str;
    }
}

// URL解析器（兼容自定义scheme）
class URLParser {
    constructor(url) {
        this.originalUrl = url;
        this.scheme = '';
        this.base = '';
        this.query = '';
        this.params = [];
        this.parse(url);
    }

    parse(url) {
        // 1. 提取scheme
        const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);
        if (schemeMatch) {
            this.scheme = schemeMatch[1];
            url = url.slice(this.scheme.length);
        }
        // 2. 查找 ? 分割query
        const qIndex = url.indexOf('?');
        if (qIndex !== -1) {
            this.base = url.slice(0, qIndex);
            this.query = url.slice(qIndex + 1);
        } else {
            this.base = url;
            this.query = '';
        }
        // 3. 解析参数
        this.params = [];
        if (this.query) {
            this.query.split('&').forEach(pair => {
                if (!pair) return;
                const eqIndex = pair.indexOf('=');
                if (eqIndex === -1) {
                    this.params.push({ key: pair, value: '' });
                } else {
                    this.params.push({ key: pair.slice(0, eqIndex), value: pair.slice(eqIndex + 1) });
                }
            });
        }
    }

    getParams() {
        return this.params;
    }

    updateParam(index, value) {
        if (index >= 0 && index < this.params.length) {
            this.params[index].value = value;
            this.updateUrl();
        }
    }

    deleteParam(index) {
        if (index >= 0 && index < this.params.length) {
            this.params.splice(index, 1);
            this.updateUrl();
        }
    }

    addParam(key, value) {
        this.params.push({ key, value });
        this.updateUrl();
    }

    moveParam(fromIndex, toIndex) {
        if (fromIndex >= 0 && fromIndex < this.params.length &&
            toIndex >= 0 && toIndex < this.params.length) {
            const [param] = this.params.splice(fromIndex, 1);
            this.params.splice(toIndex, 0, param);
            this.updateUrl();
        }
    }

    batchReplace(from, to) {
        if (!from) return;
        for (let i = 0; i < this.params.length; i++) {
            let decoded = '';
            try {
                decoded = decodeURIComponent(this.params[i].value);
            } catch (e) {
                decoded = this.params[i].value;
            }
            let replaced = decoded.split(from).join(to);
            this.params[i].value = encodeURIComponent(replaced);
        }
        this.updateUrl();
    }

    updateUrl() {
        const query = this.params.map(p => `${p.key}=${p.value}`).join('&');
        let newUrl = '';
        if (this.scheme) newUrl += this.scheme;
        newUrl += this.base;
        if (query) newUrl += '?' + query;
        document.getElementById('urlInput').value = newUrl;
        generateQRCode(newUrl);
    }
}

let currentParser = null;
const urlInputElem = document.getElementById('urlInput');

let draggedIndex = null;

function createParamElement(param, index) {
    const paramItem = document.createElement('div');
    paramItem.className = 'param-item';
    paramItem.draggable = true;
    paramItem.dataset.index = index;

    // 拖拽事件
    paramItem.addEventListener('dragstart', (e) => {
        draggedIndex = index;
        paramItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    paramItem.addEventListener('dragend', () => {
        draggedIndex = null;
        paramItem.classList.remove('dragging');
        clearDropIndicators();
    });

    const paramName = document.createElement('div');
    paramName.className = 'param-name';
    paramName.textContent = param.key;

    const paramValue = document.createElement('textarea');
    paramValue.className = 'param-value';
    let decodedValue = '';
    try {
        decodedValue = decodeURIComponent(param.value);
    } catch (e) {
        decodedValue = param.value;
    }
    if (isJsonString(decodedValue)) {
        paramValue.value = formatJson(decodedValue);
        paramValue.rows = Math.min(10, paramValue.value.split('\n').length + 1);
    } else {
        paramValue.value = decodedValue;
        paramValue.rows = 2;
    }
    setTimeout(() => {
        paramValue.style.height = 'auto';
        paramValue.style.height = paramValue.scrollHeight + 'px';
    }, 0);

    const paramActions = document.createElement('div');
    paramActions.className = 'param-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'param-btn delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = () => {
        if (currentParser) {
            currentParser.deleteParam(index);
            updateParamsList();
        }
    };
    paramActions.appendChild(deleteBtn);

    paramValue.addEventListener('input', (e) => {
        if (currentParser) {
            let newValue = e.target.value;
            if (isJsonString(newValue)) {
                try {
                    newValue = JSON.stringify(JSON.parse(newValue));
                } catch (err) {}
            }
            currentParser.updateParam(index, encodeURIComponent(newValue));
        }
        paramValue.style.height = 'auto';
        paramValue.style.height = paramValue.scrollHeight + 'px';
    });

    paramItem.appendChild(paramName);
    paramItem.appendChild(paramValue);
    paramItem.appendChild(paramActions);

    return paramItem;
}

function clearDropIndicators() {
    document.querySelectorAll('.param-item').forEach(el => {
        el.classList.remove('drop-above', 'drop-below');
    });
}

function getDropIndex(container, y) {
    const items = [...container.querySelectorAll('.param-item')];
    for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (y < midY) {
            return i;
        }
    }
    return items.length;
}

// 容器级拖拽事件 - 只绑定一次
const paramsList = document.getElementById('paramsList');

paramsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();

    const dropIndex = getDropIndex(paramsList, e.clientY);
    const items = [...paramsList.querySelectorAll('.param-item')];

    if (dropIndex < items.length) {
        items[dropIndex].classList.add('drop-above');
    } else if (items.length > 0) {
        items[items.length - 1].classList.add('drop-below');
    }
});

paramsList.addEventListener('dragleave', (e) => {
    if (!paramsList.contains(e.relatedTarget)) {
        clearDropIndicators();
    }
});

paramsList.addEventListener('drop', (e) => {
    e.preventDefault();
    const dropIndex = getDropIndex(paramsList, e.clientY);
    if (draggedIndex !== null && draggedIndex !== dropIndex && currentParser) {
        const toIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        currentParser.moveParam(draggedIndex, toIndex);
        updateParamsList();
    }
    clearDropIndicators();
});

function updateParamsList() {
    if (!currentParser) return;
    paramsList.innerHTML = '';
    const params = currentParser.getParams();
    params.forEach((param, index) => {
        const paramElement = createParamElement(param, index);
        paramsList.appendChild(paramElement);
    });
}

function addNewParam() {
    const nameInput = document.getElementById('newParamName');
    const valueInput = document.getElementById('newParamValue');
    const name = nameInput.value.trim();
    let value = valueInput.value.trim();
    if (isJsonString(value)) {
        value = JSON.stringify(JSON.parse(value));
    }
    if (name && currentParser) {
        currentParser.addParam(name, encodeURIComponent(value));
        updateParamsList();
        nameInput.value = '';
        valueInput.value = '';
    }
}

function parseURL(url) {
    if (!url) return;
    try {
        currentParser = new URLParser(url);
        // 自动替换
        const from = document.getElementById('replaceFrom').value;
        const to = document.getElementById('replaceTo').value;
        if (from) {
            currentParser.batchReplace(from, to);
            currentParser.updateUrl(); // 强制同步URL输入框内容
        }
        updateParamsList();
    } catch (error) {
        document.getElementById('paramsList').innerHTML = '';
    }
}

// URL输入框事件
urlInputElem.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    urlInputElem.style.height = 'auto';
    urlInputElem.style.height = urlInputElem.scrollHeight + 'px';
    if (url) {
        try {
            parseURL(url);
        } catch (error) {
            document.getElementById('paramsList').innerHTML = '';
        }
    } else {
        document.getElementById('paramsList').innerHTML = '';
    }
});

// 粘贴时清空已有内容
urlInputElem.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    urlInputElem.value = pastedText;
    urlInputElem.style.height = 'auto';
    urlInputElem.style.height = urlInputElem.scrollHeight + 'px';
    urlInputElem.focus();
    if (pastedText.trim()) {
        parseURL(pastedText.trim());
    }
});
window.addEventListener('load', () => {
    urlInputElem.focus();
    if (urlInputElem.value) {
        urlInputElem.style.height = 'auto';
        urlInputElem.style.height = urlInputElem.scrollHeight + 'px';
    }
});

// 清空和复制按钮
const clearBtn = document.getElementById('clearUrlBtn');
const copyBtn = document.getElementById('copyUrlBtn');
clearBtn.addEventListener('click', () => {
    urlInputElem.value = '';
    urlInputElem.style.height = 'auto';
    document.getElementById('paramsList').innerHTML = '';
});
copyBtn.addEventListener('click', () => {
    urlInputElem.select();
    document.execCommand('copy');
});

// 批量替换按钮
const replaceBtn = document.getElementById('replaceBtn');
replaceBtn.addEventListener('click', () => {
    const from = document.getElementById('replaceFrom').value;
    const to = document.getElementById('replaceTo').value;
    if (currentParser && from) {
        currentParser.batchReplace(from, to);
        updateParamsList();
    }
});

document.getElementById('newParamValue').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addNewParam();
    }
});

// 夜间模式切换
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
}

setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// 一键打开按钮
const openUrlBtn = document.getElementById('openUrlBtn');

openUrlBtn.addEventListener('click', () => {
    const url = urlInputElem.value.trim();
    if (url) {
        window.open(url, '_blank');
    }
});

// 二维码生成
let qrcodeContainer = null;

function generateQRCode(url) {
    if (!qrcodeContainer) {
        qrcodeContainer = document.getElementById('qrcode');
    }
    if (!qrcodeContainer) return;
    qrcodeContainer.innerHTML = '';
    if (!url) return;

    try {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const qr = new QRCode(qrcodeContainer, {
            text: url,
            width: 128,
            height: 128,
            colorDark: isDark ? '#4fc3f7' : '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        // 库会自动调用makeImage()隐藏canvas显示img，需要反转
        setTimeout(() => {
            const canvas = qrcodeContainer.querySelector('canvas');
            const img = qrcodeContainer.querySelector('img');
            if (canvas) canvas.style.display = 'block';
            if (img) img.style.display = 'none';
        }, 10);
    } catch(e) {
        console.error('QR Code error:', e);
    }
}

// 监听URL输入变化更新二维码
urlInputElem.addEventListener('input', () => {
    const url = urlInputElem.value.trim();
    generateQRCode(url);
});

// 二维码点击放大
const qrcodeModal = document.getElementById('qrcodeModal');
const qrcodeLarge = document.getElementById('qrcodeLarge');
const qrcodeModalClose = document.getElementById('qrcodeModalClose');
const qrcodeClickTarget = document.getElementById('qrcode');

if (qrcodeClickTarget) {
    qrcodeClickTarget.addEventListener('click', () => {
        const url = urlInputElem.value.trim();
        if (!url) return;

        qrcodeLarge.innerHTML = '';
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        new QRCode(qrcodeLarge, {
            text: url,
            width: 300,
            height: 300,
            colorDark: isDark ? '#4fc3f7' : '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
        setTimeout(() => {
            const canvas = qrcodeLarge.querySelector('canvas');
            const img = qrcodeLarge.querySelector('img');
            if (canvas) canvas.style.display = 'block';
            if (img) img.style.display = 'none';
        }, 10);

        qrcodeModal.classList.add('show');
    });
}

qrcodeModalClose.addEventListener('click', () => {
    qrcodeModal.classList.remove('show');
});

qrcodeModal.addEventListener('click', (e) => {
    if (e.target === qrcodeModal) {
        qrcodeModal.classList.remove('show');
    }
});

// 初始生成二维码
if (urlInputElem.value) {
    generateQRCode(urlInputElem.value.trim());
} 