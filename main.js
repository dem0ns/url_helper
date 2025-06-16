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

    updateParam(key, value) {
        for (let i = 0; i < this.params.length; i++) {
            if (this.params[i].key === key) {
                this.params[i].value = value;
                break;
            }
        }
        this.updateUrl();
    }

    deleteParam(key) {
        this.params = this.params.filter(p => p.key !== key);
        this.updateUrl();
    }

    addParam(key, value) {
        this.params.push({ key, value });
        this.updateUrl();
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
    }
}

let currentParser = null;
const urlInputElem = document.getElementById('urlInput');

function createParamElement(param) {
    const paramItem = document.createElement('div');
    paramItem.className = 'param-item';

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
            currentParser.deleteParam(param.key);
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
            currentParser.updateParam(param.key, encodeURIComponent(newValue));
        }
        paramValue.style.height = 'auto';
        paramValue.style.height = paramValue.scrollHeight + 'px';
    });

    paramItem.appendChild(paramName);
    paramItem.appendChild(paramValue);
    paramItem.appendChild(paramActions);

    return paramItem;
}

function updateParamsList() {
    if (!currentParser) return;
    const paramsList = document.getElementById('paramsList');
    paramsList.innerHTML = '';
    const params = currentParser.getParams();
    params.forEach(param => {
        const paramElement = createParamElement(param);
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
window.addEventListener('load', () => {
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