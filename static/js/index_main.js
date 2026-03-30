import {fetchEventSource} from "/static/js/fetch-event-source.js"
import { marked } from "/static/js/marked.js"

let msg_list = {} //全局消息列表，存储当前加载对话的所有对话内容，及之后更新的新消息
let tools_menu = {}
const chatInput = document.querySelector('#chat-input')
const sendBtn = document.querySelector('#send-btn')
const tooltip = document.getElementById('tips')
const chatIn = document.getElementById('chat-in')
let sseController = null  // SSE 全局控制器
let last_assistant_yuan =""
let global_last_task_id = 0
let isSending = false  // 防止并发发送的标志

const MERMAID_CDN_URL = "/static/js/mermaid.js"
let mermaidLoadPromise = null
let mermaidInitialized = false

function isMarkdownEnabled() {
    return localStorage.getItem('on_markdown') !== 'false'
}

function isMermaidEnabled() {
    return localStorage.getItem('on_mermaid') !== 'false'
}

function initializeMermaidDefaults() {
    if (mermaidInitialized || !window.mermaid) return
    window.mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
        }
    })
    mermaidInitialized = true
}

function ensureMermaidReady() {
    if (window.mermaid) {
        initializeMermaidDefaults()
        return Promise.resolve(window.mermaid)
    }

    if (!mermaidLoadPromise) {
        mermaidLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.src = MERMAID_CDN_URL
            script.async = true
            script.onload = () => {
                try {
                    initializeMermaidDefaults()
                    resolve(window.mermaid)
                } catch (err) {
                    reject(err)
                }
            }
            script.onerror = err => reject(err)
            document.head.appendChild(script)
        }).catch(err => {
            console.error('Mermaid 脚本加载失败:', err)
            mermaidLoadPromise = null
            throw err
        })
    }

    return mermaidLoadPromise
}

function renderMermaidBlocks(container) {
    if (!container || !isMermaidEnabled()) return
    const codeBlocks = container.querySelectorAll('pre code.language-mermaid, pre code.lang-mermaid')
    if (!codeBlocks.length) return

    const placeholders = []
    codeBlocks.forEach(codeBlock => {
        const pre = codeBlock.closest('pre')
        if (!pre || pre.dataset.mermaidProcessed === 'true') return
        const chartDefinition = codeBlock.textContent.trim()
        if (!chartDefinition) return

        const mermaidDiv = document.createElement('div')
        mermaidDiv.className = 'mermaid'
        mermaidDiv.textContent = chartDefinition

        pre.dataset.mermaidProcessed = 'true'
        pre.replaceWith(mermaidDiv)
        placeholders.push(mermaidDiv)
    })

    if (!placeholders.length) return

    ensureMermaidReady()
        .then(mermaidLib => {
            requestAnimationFrame(() => {
                try {
                    mermaidLib.init(undefined, placeholders)
                } catch (err) {
                    console.error('Mermaid 渲染失败:', err)
                }
            })
        })
        .catch(err => {
            console.error('Mermaid 加载失败:', err)
        })
}

function renderAssistantContent(targetElement, rawContent = '', options = {}) {
    if (!(targetElement instanceof HTMLElement)) return
    const useMarkdown = isMarkdownEnabled()
    const useMermaid = isMermaidEnabled()
    const content = typeof rawContent === 'string' ? rawContent : ''
    const skipMermaid = options.skipMermaid

    if (useMarkdown) {
        targetElement.innerHTML = marked.parse(content)
        if (!skipMermaid && useMermaid) {
            renderMermaidBlocks(targetElement)
        }
        addCodeCopyButtons(targetElement)
    } else {
        targetElement.innerText = content
    }
}

// 为代码块添加复制按钮
function addCodeCopyButtons(container) {
    const codeBlocks = container.querySelectorAll('pre:not(.mermaid-processed)')
    codeBlocks.forEach(pre => {
        if (pre.dataset.copyButtonAdded) return

        const code = pre.querySelector('code')
        if (!code) return

        // 创建复制按钮
        const copyBtn = document.createElement('button')
        copyBtn.className = 'code-copy-btn copy'
        copyBtn.setAttribute('aria-label', '复制代码')
        copyBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163"
                stroke="#5d5d5d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z"
                fill="none" stroke="#5d5d5d" stroke-width="3" stroke-linejoin="round" />
        </svg>`

        // 将pre改为相对定位，以便按钮绝对定位
        pre.style.position = 'relative'
        pre.appendChild(copyBtn)

        // 标记已添加
        pre.dataset.copyButtonAdded = 'true'
    })
}

async function auto_ai_title(user_msg){
    const session_id = localStorage.getItem('lastsessid')
    let chat_title = NaN;
    fetchEventSource("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({session_id: session_id,on_tools:false,on_knowledge:false,
            data:[
                {
                    "role": "system",
                    "content": "扮演标题生成器，总结用户消息，生成一个10个字以内的对话标题"
                },
                {
                    "role": "user",
                    "content": "用户消息:"+user_msg
                }
            ]
        }),
        onopen(response) {
            if (response.ok && response.status === 200) return;
            throw new Error("非正常响应，终止连接");
        },
        onmessage(ev) {
            if (ev.event === "start") {
                document.querySelectorAll("#chat-history-list .sidebar-entry").forEach(chat_a => {
                    if (chat_a.dataset.id === session_id) {
                        chat_title = chat_a.querySelector(".sidebar-entry-txt")
                        chat_title.innerText = ""
                    }
                })
            }
            else if (ev.event === "finish"){
                axios.get('/api/setting/task', {
                    params: {
                        session_id: session_id,
                    }
                })
                .then(response => {
                    // 获取返回的 JSON 数据
                    console.log(response.data)
                    if (response.data.code === 1) {
                        axios.post('/api/setting/task', {
                            session_id: session_id,
                            task_name: chat_title.innerText,
                            system: response.data.data.system,
                            avatar: response.data.data.avatar ? response.data.data.avatar : "",
                            model: response.data.data.model,
                            max_take: response.data.data.max_take,
                            temperature: response.data.data.temperature,
                            top_p: response.data.data.top_p,
                            })
                            .then(response => {
                                // 获取返回的 JSON 数据
                                console.log(response.data)
                                if (response.data.code === 1) {

                                } else {
                                    console.log(response.data.msg)
                                    alert(response.data.msg)
                                }
                            })
                            .catch(error => {
                                // 如果有错误则输出到控制台
                                console.error('请求出错:', error)
                            })





                    } else {
                        console.log(response.data.msg)
                        alert(response.data.msg)
                    }
                })
                .catch(error => {
                    // 如果有错误则输出到控制台
                    console.error('请求出错:', error)
                })
            }
            else{
                const data = JSON.parse(ev.data)
                if (data.choices?.[0]?.delta?.content){
                    chat_title.innerText += data.choices[0].delta.content
                }

            }
        },
        onerror(err) {
            console.log("\nSSE[出错] " + err + "\n")
            throw err;
        }
    });



}

// 回到底部按钮配置
const SCROLL_TO_BOTTOM_THRESHOLD = 800 // 距离底部多少像素时显示按钮

// 延迟初始化，确保DOM已加载
let scrollToBottomBtn = null
let chatArea = null

function initScrollToBottomButton() {
    scrollToBottomBtn = document.querySelector('#scroll-to-bottom-btn')
    chatArea = document.querySelector('#chat-area')
    
    if (!scrollToBottomBtn || !chatArea) {
        console.warn('回到底部按钮或聊天区域未找到')
        return
    }
    
    // 监听聊天区域的滚动事件
    chatArea.addEventListener('scroll', checkScrollToBottomButton)
    
    // 监听回到底部按钮点击
    scrollToBottomBtn.addEventListener('click', scrollToBottom)
    
    // 初始检查一次
    checkScrollToBottomButton()
}

// 检查是否需要显示回到底部按钮
function checkScrollToBottomButton() {
    if (!chatArea || !scrollToBottomBtn) return
    
    const distanceFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight
    if (distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD) {
        // 距离底部超过阈值，显示按钮
        scrollToBottomBtn.classList.add('show')
    } else {
        // 接近底部，隐藏按钮
        scrollToBottomBtn.classList.remove('show')
    }
}

// 滚动到底部
function scrollToBottom() {
    if (!chatArea) return
    chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
    })
}

function ch_del(sessid) {
    const cspdel = document.querySelector('#chat-history-list .csp #csp-del')
    if (cspdel.innerText === `确定吗?`){
        if(sessid === localStorage.getItem('lastsessid')){
            localStorage.removeItem('lastsessid')
            window.location.href = '/'
        }

        axios.get('/api/task/del', {
                params: {
                    session_id: sessid,
                }
            })
            .then(response => {
                if (response.data.code === 1) {
                    console.log(response.data)
                }
                else{
                    console.log(response.data.msg)
                }
            })
            .catch(error => {
                // 如果有错误则输出到控制台
                console.error('请求出错:', error)
            })

        cspdel.parentNode.parentNode.remove()
    }
    else{
        cspdel.innerText = `确定吗?`
    }
}

async function ch_edit(sessid) {
    document.body.classList.add('mask')

    document.querySelector("#chat-history-list .chat-setting").remove()
    document.querySelector("#chat-history-list .csp").remove()

    const setbox = document.querySelector('.setting-box')

    setbox.style.display = "block"
    setTimeout(() => {
        setbox.classList.add('active')
    }, 10)
    let model_data=[]
    await axios.get('/api/setting/model')
        .then(response => {
            // 获取返回的 JSON 数据
            console.log(response.data)
            if (response.data.code === 1) {
                model_data = response.data.data
                const chat_model = document.getElementById('chat-model')
                chat_model.innerHTML = ''
                model_data.forEach(model_son =>{
                    const opt = new Option(model_son.model_name, model_son.model_uuid)
                    chat_model.add(opt)
                })
            } else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })


    await axios.get('/api/setting/task', {
            params: {
                session_id: sessid,
            }
        })
        .then(response => {
            // 获取返回的 JSON 数据
            console.log(response.data)
            if (response.data.code === 1) {
                setbox.querySelector("#session-id").value = response.data.data.session_id
                setbox.querySelector("#task-name").value = response.data.data.title
                setbox.querySelector("#system").value = response.data.data.system
                setbox.querySelector('#displayImage').src = response.data.data.avatar
                setbox.querySelector("#max-take").value = response.data.data.max_take
                setbox.querySelector("#max-take-in").value = response.data.data.max_take
                setbox.querySelector("#temperature").value = response.data.data.temperature
                setbox.querySelector("#temperature-in").value = response.data.data.temperature
                setbox.querySelector("#top-p").value = response.data.data.top_p
                setbox.querySelector("#top-p-in").value = response.data.data.top_p

                // 根据当前对话的模型 UUID 自动选择对应的模型
                const currentModelUuid = response.data.data.model
                const chatModelSelect = document.getElementById('chat-model')
                chatModelSelect.value = currentModelUuid

                // 触发 change 事件来更新对应的模型参数
                const changeEvent = new Event('change')
                chatModelSelect.dispatchEvent(changeEvent)

            } else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })

    // 监听每次选择变化
    const chat_model = document.getElementById('chat-model')
    chat_model.addEventListener('change', function (e) {
        console.log('选择已更改，当前值：', e.target.value)
        model_data.forEach(model_son =>{
            if (model_son.model_uuid === e.target.value){
                setbox.querySelector("#system").value = model_son.system
                setbox.querySelector("#max-take").value = model_son.max_take
                setbox.querySelector("#max-take-in").value = model_son.max_take
                setbox.querySelector("#temperature").value = model_son.temperature
                setbox.querySelector("#temperature-in").value = model_son.temperature
                setbox.querySelector("#top-p").value = model_son.top_p
                setbox.querySelector("#top-p-in").value = model_son.top_p
            }
        })

    })
}

function ch_put(sessid) {
    const currentSessionId = localStorage.getItem('lastsessid')
    if (!currentSessionId) {
        alert('未找到当前会话记录，无法导出。')
        return
    }

    if (sessid !== currentSessionId) {
        alert('请先打开该会话后再导出。')
        return
    }

    const chatContainer = document.querySelector('#chat-in')
    if (!chatContainer) {
        alert('未找到对话内容，无法导出。')
        return
    }

    const lines = []

    const systemContent = chatContainer.querySelector('.c-system .content')
    if (systemContent) {
        const systemText = systemContent.innerText.trim()
        if (systemText) {
            lines.push('###system', systemText, '', '')
        }
    }

    const messageNodes = Array.from(chatContainer.querySelectorAll('.c-user, .c-assistant'))

    messageNodes.forEach(node => {
        const contentNode = node.querySelector('.content')
        const contentText = contentNode ? contentNode.innerText.trim() : ''

        if (contentText) {
            const role = node.classList.contains('c-user') ? 'user' : 'assistant'
            lines.push(`###${role}`, contentText, '', '')
        }

        const toolBox = node.querySelector('.tools-call-box')
        if (toolBox) {
            const callId = toolBox.querySelector('.tools-call-id .tools-content')?.innerText.trim()
            const callName = toolBox.querySelector('.tools-call-name .tools-content')?.innerText.trim()
            const callArgs = toolBox.querySelector('.tools-call-params .tools-content')?.innerText.trim()
            const callReturn = toolBox.querySelector('.tools-call-return .tools-content')?.innerText.trim()

            const toolLines = []
            if (callId) toolLines.push(`id: ${callId}`)
            if (callName) toolLines.push(`name: ${callName}`)
            if (callArgs) toolLines.push(`arguments: ${callArgs}`)
            if (callReturn) toolLines.push(`return: ${callReturn}`)

            if (toolLines.length) {
                lines.push('###tool',  toolLines.join('\n'), '', '')
            }
        }





    })

    const textContent = lines.join('\n')
    if (!textContent.trim()) {
        alert('当前对话为空，未生成导出内容。')
        return
    }
    let chat_task_name = ""
    document.querySelectorAll("#chat-history-list a").forEach(chat_a => {
        if (chat_a.dataset.id === sessid) {
            chat_task_name = chat_a.querySelector(".sidebar-entry-txt").innerText
        }
    })
    const filename = `${chat_task_name}.txt`
    const blob = new Blob([textContent], {type: 'text/plain;charset=utf-8'})
    const downloadLink = document.createElement('a')
    downloadLink.href = URL.createObjectURL(blob)
    downloadLink.download = filename
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    setTimeout(() => {
        URL.revokeObjectURL(downloadLink.href)
    }, 2000)
}


function listen_system(){

    const system_content = document.querySelector('.c-system .content')
    let oldContent = ''

    system_content.addEventListener('focus', () => {
      oldContent = system_content.innerText  // 记录进入编辑前的内容
    })

    system_content.addEventListener('blur', () => {
        if (system_content.innerText !== oldContent) {
            console.log('system内容已更改:', system_content.innerText)
            axios.post("/api/setting/system",{
                session_id: localStorage.getItem('lastsessid'),
                system: system_content.innerText
            })
                .then(response => {
                    // 获取返回的 JSON 数据
                    console.log(response.data)
                    if (response.data.code === 1) {
                        console.log(response.data.msg)
                    } else {
                        console.log(response.data.msg)
                        alert(response.data.msg)
                    }
                })
                .catch(error => {
                    // 如果有错误则输出到控制台
                    console.error('请求出错:', error)
                })

        }
        else {
            console.log('内容未变化')
        }
    })

}

async function load_history(sessid){

    if (!sessid) return

    const sidebarMask = document.querySelector('#global-mask')
    sidebarMask.style.display = "flex"
    sidebarMask.innerText = "加载中..."

    await axios.get('/api/chat/history', {
            params: {
                session_id: sessid,
            }
        })
        .then(response => {
            if (response.data.code === 1) {

                function load_msg(find_uuid){

                    let last_msg_id = ""

                    const item = msg_list[find_uuid]
                    if (item.role === "user") {
                        const user_node = copy_user.cloneNode(true)
                        last_msg_id = item.parent_id
                        user_node.querySelector(".content").innerText = item.content
                        user_node.dataset.id = find_uuid

                        chat_main.prepend(user_node)
                    }
                    else if (item.role === "assistant" || "tool") {
                        const assistant_node = copy_assistant.cloneNode(true)

                        last_msg_id = item.parent_id
                        renderAssistantContent(assistant_node.querySelector(".content"), item.content)
                        if(item.more_info){
                            assistant_node.querySelector(".assistant-more-info").innerText = `used tokens:${item.more_info.used_token ? item.more_info.used_token : NULL}, model:${item.more_info.model ? item.more_info.model : NULL}`
                            if (! (localStorage.getItem("on_moreinfo") !== 'false'))
                                assistant_node.querySelector(".assistant-more-info").style.display = "none"
                        }

                        assistant_node.dataset.id = find_uuid
                        //加载工具显示
                        if (item.tool_return) {
                            //将工具响应数据存在字典内备用
                            tools_menu[item.tool_return.tool_call_id] = item.tool_return.content
                        }
                        if (item.tool_calls) {
                            //一般只会有一条数据进入循环，为之后扩展做准备
                            item.tool_calls.forEach(tool => {
                                const tool_node = copy_tools.cloneNode(true)
                                tool_node.querySelector(".tools-call-name .tools-content").innerText = tool.function.name
                                tool_node.querySelector(".tools-call-params .tools-content").innerText = tool.function.arguments
                                tool_node.querySelector(".tools-call-id .tools-content").innerText = tool.id
                                if (tools_menu[tool.id]) {
                                    tool_node.querySelector(".tools-call-return .tools-content").innerText = tools_menu[tool.id]
                                    tool_node.querySelector(".tools-call-return").style.display = "block"
                                }
                                assistant_node.insertBefore(tool_node, assistant_node.children[1])
                            })
                        }

                        chat_main.prepend(assistant_node)
                    }

                    //加载横向对话
                    if(last_msg_id){
                        const children_list = msg_list[last_msg_id].children
                        if (children_list.length > 1) {
                            const total = children_list.length
                            const index = children_list.indexOf(find_uuid)
                            const position = index + 1
                            const prev = children_list[index - 1] !== undefined ? children_list[index - 1] : null
                            const next = children_list[index + 1] !== undefined ? children_list[index + 1] : null

                            const chat_tree = document.querySelector("#source #chat-tree").cloneNode(true)
                            const check_buttons = chat_tree.querySelectorAll(".check-button")
                            check_buttons[0].dataset.id = prev
                            check_buttons[1].dataset.id = next
                            chat_tree.querySelector("#check-content").innerText = `${position}/${total}`

                            console.log(`拥有值${find_uuid}，共${total}位，处于第${position}位，上一个值${prev}，下一个值${next}`)
                            if(chat_main.firstElementChild.className === "c-user"){
                                chat_main.firstElementChild.lastElementChild.appendChild(chat_tree)
                            }else{
                                chat_main.firstElementChild.lastElementChild.prepend(chat_tree)
                            }

                        }
                    }
                    return last_msg_id
                }

                console.log(response.data)

                document.querySelector("#max-take-now").value = response.data.max_take
                msg_list = response.data.data
                //添加对话
                const chat_main = document.querySelector("#chat-in")
                const copy_user = document.querySelector("#source .c-user")
                const copy_assistant = document.querySelector("#source .c-assistant")
                const copy_tools = document.querySelector('#source .tools-call-box')

                chat_main.innerText = ""

                //最后一条消息的id，能通过后端传过来，根据最后创建时间来获得
                let last_msg_id = response.data.last_msg_id


                while (last_msg_id){
                    last_msg_id = load_msg(last_msg_id)
                }



                //系统提示词加载
                chat_main.prepend(document.querySelector("#source .c-system").cloneNode(true))
                chat_main.querySelector(".c-system .content").innerText = response.data.system
                listen_system()

                chat_main.parentNode.scrollTop = chat_main.parentNode.scrollHeight  // 立即滚动到底
                // 检查是否显示回到底部按钮
                setTimeout(() => checkScrollToBottomButton(), 100)

            }
            else {
                console.log(response.data.msg)
                alert(response.data.msg)
                history.pushState(null, '', `/`)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })

    sidebarMask.style.display = "none"
    sidebarMask.innerText = ""
}

//剪贴板操作
function copyText(text) {
    // 优先使用现代 API
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
            .then(() => console.log('已复制到剪贴板'))
            .catch(err => console.error('复制失败:', err))
    } else {
        // 旧浏览器兼容方案
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        try {
            const ok = document.execCommand('copy')
            console.log(ok ? '已复制到剪贴板' : '复制失败')
        } catch (err) {
            console.error('复制失败:', err)
        }
        document.body.removeChild(textarea)
    }
}

//生成随机UUID
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    )
}

//页面消息发送与新消息加载
// userMsgToRollback: 如果发生错误需要回退的用户消息元素（可选）
async function send_msg(userMsgToRollback = null) {
    // 防止并发发送
    if (isSending) {
        console.log("已有发送进行中，跳过此次请求")
        return
    }
    isSending = true

    // 如果上一个 SSE 还在，就终止它
    if (sseController) {
        sseController.abort()

        const assistant_boxs = document.querySelectorAll('#chat-in .c-assistant')
        const assistant_box = assistant_boxs[assistant_boxs.length - 1]
        //将中断的ai回复同步服务器
        update_msg(assistant_box)
        setTimeout(() => {
                console.log("SSE上一个连接已终止")
            }, 50)


    }

    sseController = new AbortController() // 新建控制器
    const signal = sseController.signal

    //获取对话信息
    const session_id = localStorage.getItem('lastsessid')
    //加载历史对话
    const max_take = Number(document.querySelector("#chat-area #max-take-now").value)
    const task_data = []

    // 获取所有消息节点
    const allmsgbox = Array.from(document.querySelectorAll("#chat-in .c-user .content,#chat-in .c-assistant .content"))

    for (let i = 0; i < max_take; i++) {
        let index = allmsgbox.length - 1 - i
        if (index >= 0) {
            task_data.unshift(
                {
                    "role": allmsgbox[index].parentNode.className === "c-user" ? "user" : "assistant",
                    "content": allmsgbox[index].innerText
                }
            )
            if (allmsgbox[index].parentNode.querySelector(".tools-call-box")) {//存在tools-call
                task_data[0]["tool_calls"] = [
                    {
                        "id": allmsgbox[index].parentNode.querySelector(".tools-call-box .tools-call-id .tools-content").innerText,
                        "type": "function",
                        "function": {
                            "name": allmsgbox[index].parentNode.querySelector(".tools-call-box .tools-call-name .tools-content").innerText,
                            "arguments": allmsgbox[index].parentNode.querySelector(".tools-call-box .tools-call-params .tools-content").innerText
                        }
                    }
                ]
                task_data.splice(1, 0, {
                    "role": "tool",
                    "tool_call_id": allmsgbox[index].parentNode.querySelector(".tools-call-box .tools-call-id .tools-content").innerText,
                    "content": allmsgbox[index].parentNode.querySelector(".tools-call-box .tools-call-return .tools-content").innerText
                })
            }
        } else {
            break
        }

    }

    // 添加 system 消息
    const systemContent = document.querySelector("#chat-in .c-system .content")
    if (systemContent) {
        task_data.unshift({"role": "system", "content": systemContent.innerText})
    }

    const assistantDiv = document.querySelector("#source .c-assistant").cloneNode(true)
    assistantDiv.querySelector(".assistant-group").style.display = "none"
    const chat_area = document.querySelector("#chat-area")
    let currentText = ''
    const tool_call_box = document.querySelector('#source .tools-call-box').cloneNode(true)
    const on_tools = localStorage.getItem('on_tools') !== 'false'
    const on_knowledge = localStorage.getItem('on_knowledge') !== 'false'
    return fetchEventSource("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({session_id: session_id,on_tools:on_tools,on_knowledge:on_knowledge, data: task_data}),
        signal,
        openWhenHidden: true,  // 后台/切换标签不主动中断和重连
        onopen(response) {
            currentText = '' // 每次新对话重置
            last_assistant_yuan = ''
            if (response.ok && response.status === 200) return;
            throw new Error("非正常响应，终止连接");
        },
        onmessage(ev) {
            if (ev.event === "start") {
                document.querySelector("#chat-in").appendChild(assistantDiv)
                assistantDiv.querySelector(".content").appendChild(document.querySelector("#source .loading-dots").cloneNode(true))
            }
            else if (ev.event === "finish") {
                renderAssistantContent(assistantDiv.querySelector(".content"), last_assistant_yuan)
                assistantDiv.querySelector(".assistant-group").style.display = "flex"
                update_msg(assistantDiv)
                sseController = null
                isSending = false  // 重置发送标志
                // 消息完成时检查按钮状态
                setTimeout(() => checkScrollToBottomButton(), 100)
                //检查是否存在tools_call
                const tools_box = assistantDiv.querySelector(".tools-call-box")
                if (tools_box) {
                    tools_box.querySelector(".tools-call-actions").style.display = "flex"

                    //存在工具调用请求则给两个按钮绑定事件
                    tools_box.querySelector(".btn-cancel").addEventListener("click", function () {
                        tools_box.remove()
                    })
                    tools_box.querySelector(".btn-confirm").addEventListener("click", function () {
                        tools_box.querySelector(".tools-call-actions").style.display = "none"
                        axios.post('/api/chat/tools', {
                            tools_call_name: tools_box.querySelector(".tools-call-name .tools-content").innerText,
                            tools_call_params: JSON.parse(tools_box.querySelector(".tools-call-params .tools-content").innerText),
                        })
                            .then(response => {
                                // 获取返回的 JSON 数据
                                console.log(response.data)
                                if (response.data.code === 1) {
                                    //获取到工具响应结果
                                    tools_box.querySelector(".tools-call-return .tools-content").innerText = response.data.data
                                    tools_box.querySelector(".tools-call-return").style.display = "block"
                                    tools_box.querySelector(".tools-call-actions").remove()
                                    update_msg(tools_box)
                                    //二次消息发送（工具调用后继续对话，不需要回退）
                                    send_msg(null)


                                } else {
                                    tools_box.querySelector(".tools-call-actions").style.display = "flex"
                                    console.log(response.data.msg)
                                    alert(response.data.msg)
                                }
                            })
                            .catch(error => {
                                // 如果有错误则输出到控制台
                                console.error('请求出错:', error)
                            })
                    })
                    if (localStorage.getItem('on_auto_tools') !== 'false')
                        tools_box.querySelector(".btn-confirm").click()
                }

            }
            else if (ev.event === "error") {
                // 错误处理：回退消息
                console.log("AI对话出错，开始回退消息")
                sseController = null
                isSending = false  // 重置发送标志
                
                // 1. 移除assistant消息DOM (如果已添加)
                if (assistantDiv.parentNode) {
                    assistantDiv.remove()
                }
                
                // 2. 如果指定了要回退的用户消息，则回退它
                if (userMsgToRollback && userMsgToRollback.parentNode) {
                    const user_content = userMsgToRollback.querySelector(".content").innerText
                    const user_uuid = userMsgToRollback.dataset.id
                    
                    // 3. 将用户消息内容放回输入框
                    chatInput.value = user_content
                    
                    // 4. 发送回退请求到后端（删除用户消息记录）
                    if (user_uuid) {
                        axios.post('/api/chat/rollback', {
                            session_id: session_id,
                            chat_uuid: user_uuid
                        }).then(response => {
                            console.log("消息回退成功:", response.data)
                        }).catch(error => {
                            console.error('消息回退请求失败:', error)
                        })
                        
                        // 5. 从msg_list中删除这条用户消息
                        if (msg_list[user_uuid]) {
                            // 从父消息的children中移除
                            const parent_id = msg_list[user_uuid].parent_id
                            if (parent_id && msg_list[parent_id]) {
                                const children = msg_list[parent_id].children
                                const index = children.indexOf(user_uuid)
                                if (index > -1) {
                                    children.splice(index, 1)
                                }
                            }
                            // 删除消息本身
                            delete msg_list[user_uuid]
                        }
                    }
                    
                    // 6. 移除用户消息DOM
                    userMsgToRollback.remove()
                    
                    alert("AI对话出错，消息已回退到输入框，请重新发送")
                } else {
                    // 没有指定回退消息（如try-again场景），只提示错误
                    alert("AI对话出错，请重试")
                }
            }
            else {

                //拼接AI信息
                const data = JSON.parse(ev.data)
                if (data.choices?.[0]?.delta?.content) {
                    // 修改这里：累积文本并实时渲染markdown
                    last_assistant_yuan += data.choices[0].delta.content
                    renderAssistantContent(assistantDiv.querySelector(".content"), last_assistant_yuan, {skipMermaid: true})
                }
                else if (data.choices?.[0]?.delta?.tool_calls) {
                    if (data.choices[0].delta.tool_calls[0].id) {
                        const tool_call_id = data.choices[0].delta.tool_calls[0].id
                        const tool_call_name = data.choices[0].delta.tool_calls[0].function.name
                        assistantDiv.insertBefore(tool_call_box, assistantDiv.children[1])
                        tool_call_box.querySelector(".tools-call-name .tools-content").innerText = tool_call_name
                        tool_call_box.querySelector(".tools-call-id .tools-content").innerText = tool_call_id
                        tool_call_box.classList.toggle('expanded')
                        tool_call_box.querySelector('.tools-toggle-btn').textContent = '收起'

                    }
                    tool_call_box.querySelector(".tools-call-params .tools-content").innerText += data.choices[0].delta.tool_calls[0].function.arguments ? data.choices[0].delta.tool_calls[0].function.arguments : ""
                }
                else if (data.choices[0].finish_reason === "stop") {
                    assistantDiv.querySelector(".assistant-more-info").innerText = `used tokens: ${data.usage ? data.usage.total_tokens : "NULL"},model: ${data.model}`
                    if (! (localStorage.getItem("on_moreinfo") !== 'false'))
                        assistantDiv.querySelector(".assistant-more-info").style.display = "none"
                }

                setTimeout(() => {
                    // 只有当用户接近底部（距离底部100px内）时才自动滚动
                    const scrollThreshold = 100
                    const distanceFromBottom = chat_area.scrollHeight - chat_area.scrollTop - chat_area.clientHeight
                    if (distanceFromBottom <= scrollThreshold) {
                        chat_area.scrollTop = chat_area.scrollHeight
                    }
                    // 检查是否显示回到底部按钮
                    checkScrollToBottomButton()
                }, 0)

            }
        },
        onerror(err) {
            console.log("\nSSE[出错] " + err + "\n")
            throw err;
        },
        onclose() {
            sendBtn.classList.remove('stoptype')
            sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 6V42" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 18L24 6L36 18" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

            console.log("\n[连接关闭]\n")
            isSending = false  // 重置发送标志
        }
    });

}

//更新记录
async function update_msg(element){
    if (!(element instanceof HTMLElement)) {
        console.error("参数不是一个有效的HTML元素")
        return
    }
    const session_id = localStorage.getItem('lastsessid')

    const msg = {
        session_id: session_id,
        created_at: ~~(Date.now() / 1000),
    }

    if (element.classList.contains('tools-call-box')){
        msg["chat_uuid"]= element.closest('.c-assistant').dataset.id
        msg["role"]= "tool"
        msg["metadata"]={
            role: "tool",
            content: element.querySelector(".tools-call-return .tools-content").innerText,
            tool_call_id: element.querySelector(".tools-call-id .tools-content").innerText,
        }
        msg_list[msg["chat_uuid"]]["tool_return"] = {
            "tool_call_id": element.querySelector(".tools-call-id .tools-content").innerText,
            "content": element.querySelector(".tools-call-return .tools-content").innerText
        }


    }
    else{
        const chat_uuid = generateUUID()

        element.dataset.id = chat_uuid
        msg["chat_uuid"]= chat_uuid

        msg["role"]= element.className === "c-assistant" ? "assistant":"user"

        msg["metadata"]={
            content: element.querySelector(".content").innerText,
            parent_id: element.previousElementSibling.dataset.id
        }

        if(element.className === "c-assistant"){//拿取assistant原始消息
            msg["metadata"]["content"] = last_assistant_yuan
        }

        if (element.querySelector(".tools-call-box")){
            msg["metadata"]["tool_calls"] = [
            {
                "id": element.querySelector(".tools-call-box .tools-call-id .tools-content").innerText,
                "type": "function",
                "function": {
                    "name": element.querySelector(".tools-call-box .tools-call-name .tools-content").innerText,
                    "arguments": element.querySelector(".tools-call-box .tools-call-params .tools-content").innerText
                }
            }
        ]
        }
        if (element.querySelector(".assistant-more-info")) {
            const match = element.querySelector(".assistant-more-info").innerText.match(/tokens:\s*(\d+)\s*,\s*model:\s*([\w-]+)/)
            if (match) {
                msg["metadata"]["more_info"] = {
                    "used_token": match[1],
                    "model": match[2]
                }
            }
        }

        msg_list[msg["chat_uuid"]]= {
            "role":msg["role"],
            "children":[],
            ...msg["metadata"]
        }

        if(element.previousElementSibling.className !== "c-system"){
            msg_list[element.previousElementSibling.dataset.id]["children"].unshift(msg["chat_uuid"])
        }
    }

    return axios.post('/api/chat/history', msg)
        .then(response => {
            // 获取返回的 JSON 数据
            console.log(response.data)
            if (response.data.code === 1) {
                console.log(response.data.msg)
            } else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)

        })
}

async function update_task_list(last_task_id){
    //初始化 AI对话列表
    const chatHistoryList = document.querySelector("#chat-history-list")
    if(last_task_id === 0)
        chatHistoryList.innerText = ""

    return axios.get('/api/task/list',{
            params: {
                last_task_id: last_task_id
            }
        })
        .then(response => {
            const res = response.data
            if (res.code === 1) {
                // 提取 data 数组里的 title、id、session_id
                res.data.forEach(item => {
                    chatHistoryList.innerHTML += `<a class="sidebar-btn-hover sidebar-entry" href="/chat/${item.session_id}" data-id="${item.session_id}">
                                                    <div class="sidebar-entry-txt">${item.title}</div>
                                                  </a>`
                })
                if(res.data.length == 0)
                    global_last_task_id = -1
                else{
                    global_last_task_id = Number(res.data[res.data.length - 1].id)

                    const adoms = document.querySelectorAll('#chat-history-list a')
                    adoms.forEach(adom => {
                        //显示编辑按钮
                         adom.addEventListener('mouseenter', function (e) {
                            const oldset=this.querySelector('.chat-setting')
                            if (oldset) oldset.remove()
                            const chatset = document.createElement('div')
                            chatset.classList.add('chat-setting')
                            chatset.classList.add('sidebar-entry-svg')
                            chatset.innerText = `···`
                            this.append(chatset)
                        })
                        //关闭编辑按钮
                        adom.addEventListener('mouseleave', function (e) {
                            this.querySelector('.chat-setting').remove()
                            const oldPopup = document.querySelector('#chat-history-list .csp')
                            if (oldPopup) {
                                oldPopup.classList.add('fade-out')
                                setTimeout(() => {
                                    oldPopup.remove()
                                }, 150)
                            }
                        })
                        //操作编辑按钮，对话加载页面更新
                        adom.addEventListener('click', function (e) {
                            e.preventDefault()
                            console.log(e)

                            //点击编辑菜单不判断
                            if (e.target.className === "csp-c") return
                            //拿取sessid
                            const session_id = e.target.parentNode.dataset.id
                            //检测点击编辑按钮
                            if (e.target.className === "chat-setting sidebar-entry-svg"){
                                const chatSetting = e.target
                                if (chatSetting) {
                                    if (this.querySelector('.csp')){
                                        this.querySelector('.csp').remove()
                                        return
                                    }
                                    // 查找弹窗蒙版
                                    const csp = document.querySelector('#source .csp')
                                    const popup = csp.cloneNode(true)
                                    // 使用 fixed 定位，基于视口定位，不受滚动影响
                                    popup.style.position = 'fixed'
                                    // 获取 chatSetting 相对于视口的位置
                                    const chatSettingRect = chatSetting.getBoundingClientRect()
                                    // 获取 chat-history-list 容器的位置
                                    const chatHistoryList = document.querySelector('#chat-history-list')
                                    const listRect = chatHistoryList.getBoundingClientRect()

                                    // 计算菜单位置
                                    let left = chatSettingRect.left + chatSetting.offsetWidth - 30
                                    let top = chatSettingRect.bottom + 4

                                    // 检查是否超出容器底部，如果超出则向上显示
                                    // 增加触发阈值，只有在菜单真的超出时才向上显示
                                    const popupHeight = 120 // 菜单高度
                                    const containerBottom = listRect.bottom
                                    const bottomSpace = containerBottom - top

                                    // 只有当底部空间严重不足时才向上显示（阈值从 +10 改为 +20）
                                    if (bottomSpace < popupHeight + 20) {
                                        // 空间不足，向上显示
                                        top = chatSettingRect.top - popupHeight - 4
                                    }

                                    popup.style.left = left + 'px'
                                    popup.style.top = top + 'px'
                                    popup.style.zIndex = 1002
                                    popup.querySelector('#csp-del').onclick = function () {
                                        ch_del(session_id)
                                    }
                                    popup.querySelector('#csp-edit').onclick = function () {
                                        ch_edit(session_id)
                                    }
                                    popup.querySelector('#csp-put').onclick = function () {
                                        ch_put(session_id)
                                    }
                                    chatSetting.parentElement.appendChild(popup)
                                    setTimeout(() => {
                                        popup.classList.add('active')
                                    }, 10)
                                }
                            }
                            //对话本身被点击。切换对话
                            else{
                                if(e.target.closest('.csp')){
                                    return
                                }
                                let session_id = ""
                                if(e.target.className === "sidebar-entry-txt"){
                                        session_id = e.target.parentNode.dataset.id
                                    }
                                else{
                                        session_id = e.target.dataset.id
                                    }
                                const old_session_id = localStorage.getItem('lastsessid')
                                if (old_session_id !== session_id){//防止重复加载
                                    const old_tasking = e.target.closest('#chat-history-list').querySelectorAll(".tasking")
                                    old_tasking.forEach(div => {
                                      div.classList.remove('tasking')
                                    })
                                    e.target.closest('a').classList.add('tasking')
                                    // 更新地址栏地址
                                    history.pushState(null, '', `/chat/${session_id}`)
                                    load_history(session_id)
                                }
                                localStorage.setItem('lastsessid', session_id)
                            }
                        })
                     })
                }

            }
            else {
                // 处理错误信息
                alert(res.msg)
            }

        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })
}


async function add_new_task(){
    const session_id = generateUUID()
    history.pushState(null, '', `/chat/${session_id}`)

    return axios.get('/api/task/add',{
            params: {
                session_id:session_id
            }
        })
        .then(response => {
            if (response.data.code === 1){
                console.log(response.data.msg)
                localStorage.setItem('lastsessid', session_id)
            }
            else{
                console.log(response.data.msg)
            }

        })
        .catch(error => {
                    // 如果有错误则输出到控制台
                    console.error('请求出错:', error)
                })

}

function open_setting_box(element){
    document.body.classList.add('mask')
    element.style.display = "block"
    setTimeout(() => {
        element.classList.add('active')
    }, 10)
}

function close_setting_box(element){
    element.classList.remove('active')
    setTimeout(() => {
        element.style.display = "none"
        document.body.classList.remove('mask')
    }, 300)
}

//页面初始化
!(async function () {
    //初始组建绑定
    document.querySelector("#new-chat").addEventListener("click", async function (e) {
        e.preventDefault()

        await add_new_task()

        location.reload(true)

    })

    document.querySelector("#knowledge-setting").addEventListener("click", async function (e) {
        e.preventDefault()

        const setbox = document.querySelector('.knowledge-setting-box')
        open_setting_box(setbox)
        const setbox_main = setbox.querySelector("#chatset")
        setbox_main.innerHTML = `<div class="knowledge—list"> <div class="knowledge—list-content" contenteditable="true"> </div><button id="setbox-save">保存</button></div>`

        await axios.get('/api/knowledge')
            .then(response => {
                // 获取返回的 JSON 数据
                console.log(response.data)
                if (response.data.code === 1) {
                    response.data.data.forEach(kl => {
                        setbox_main.innerHTML = `<div class="knowledge—list"> <div class="knowledge—list-content">${kl}</div> <button id="setbox-del">删除</button></div>` + setbox_main.innerHTML
                    })
                } else {
                    console.log(response.data.msg)
                    alert(response.data.msg)
                }
            })
            .catch(error => {
                // 如果有错误则输出到控制台
                console.error('请求出错:', error)
            })

    })

    document.querySelector("#model-setting").addEventListener("click", async function (e) {
        e.preventDefault()
        const setbox = document.querySelector('.model-setting-box')
        //初始化
        setbox.querySelector("#model-uuid").innerText = ""
        setbox.querySelector('#model-name').value = ""
        setbox.querySelector("#model").value = ""
        setbox.querySelector("#system").value = ""
        setbox.querySelector("#max-take").value = 0
        setbox.querySelector("#max-take-in").value = 0
        setbox.querySelector("#temperature").value = 0
        setbox.querySelector("#temperature-in").value = 0
        setbox.querySelector("#top-p").value = 0
        setbox.querySelector("#top-p-in").value = 0
        setbox.querySelector("#base-url").value = ""
        setbox.querySelector("#api-key").value = ""
        open_setting_box(document.querySelector('.model-setting-box'))
        let model_data = []
        await axios.get('/api/setting/model')
            .then(response => {
                // 获取返回的 JSON 数据
                console.log(response.data)
                if (response.data.code === 1) {
                    model_data = response.data.data
                    const chat_model = document.getElementById('model-name-list')
                    chat_model.innerHTML = ''
                    model_data.forEach(model_son => {
                        const opt = document.createElement('option')
                        opt.value = model_son.model_name
                        chat_model.appendChild(opt)
                        model_son.api_key = localStorage.getItem(model_son.model_uuid)||"非配置设备,内容被隐藏"
                    })
                } else {
                    console.log(response.data.msg)
                    alert(response.data.msg)
                }
            })
            .catch(error => {
                // 如果有错误则输出到控制台
                console.error('请求出错:', error)
            })

        // 监听每次选择变化
        const model_name = document.getElementById('model-name')
        await model_name.addEventListener('change', function (e) {
            console.log('选择已更改，当前值：', e.target.value)
            setbox.querySelector("#model-uuid").innerText = ""
            model_data.forEach(model_son => {
                if (e.target.value === model_son.model_name) {
                    setbox.querySelector("#model-uuid").innerText = model_son.model_uuid
                    setbox.querySelector("#model").value = model_son.model
                    setbox.querySelector("#system").value = model_son.system
                    setbox.querySelector("#max-take").value = model_son.max_take
                    setbox.querySelector("#max-take-in").value = model_son.max_take
                    setbox.querySelector("#temperature").value = model_son.temperature
                    setbox.querySelector("#temperature-in").value = model_son.temperature
                    setbox.querySelector("#top-p").value = model_son.top_p
                    setbox.querySelector("#top-p-in").value = model_son.top_p
                    setbox.querySelector("#base-url").value = model_son.base_url
                    setbox.querySelector("#api-key").value = model_son.api_key
                }
            })
        })
    })

    document.querySelector("#mcpserver-setting").addEventListener("click", async function (e) {
        e.preventDefault()
        const setbox = document.querySelector('.mcpserver-setting-box')
        open_setting_box(setbox)
        const mcpToolsList = setbox.querySelector("#mcp-tools-list")
        
        await loadMcpServers(mcpToolsList)
    })

    // 添加服务器按钮
    document.querySelector("#mcp-add-btn").addEventListener("click", function(e) {
        e.preventDefault()
        const addBox = document.querySelector('.mcp-add-server-box')
        open_setting_box(addBox)
    })

    // 确认添加服务器
    document.querySelector("#mcp-add-confirm").addEventListener("click", async function() {
        const jsonInput = document.querySelector('#mcp-server-json').value.trim()
        
        if (!jsonInput) {
            alert('请输入服务器配置JSON')
            return
        }
        
        // 验证JSON格式
        let serverData
        try {
            serverData = JSON.parse(jsonInput)
        } catch (e) {
            alert('JSON格式错误：' + e.message)
            return
        }
        
        // 禁用按钮，显示加载状态
        this.disabled = true
        this.innerText = '添加中...'
        
        try {
            const response = await axios.post('/api/mcp/add', {
                server_data: serverData
            })
            
            if (response.data.code === 1) {
                
                // 关闭添加弹窗
                document.querySelector('#mcp-add-cancel').click()
                
                // 重新加载服务器列表
                const container = document.querySelector('#mcp-tools-list')
                await loadMcpServers(container)
            } else {
                alert('添加失败：' + response.data.msg)
            }
        } catch (error) {
            console.error('添加服务器失败:', error)
            alert('添加失败：' + (error.response?.data?.msg || error.message))
        } finally {
            this.disabled = false
            this.innerText = '确认添加'
        }
    })
    
    // 加载MCP服务器列表的函数
    async function loadMcpServers(container) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;">加载中...</div>'
        
        try {
            const response = await axios.get('/api/mcp/config')
            console.log(response.data)
            
            if (response.data.code === 1) {
                const serversData = response.data.data
                container.innerHTML = ''
                
                // 显示并绑定重新加载按钮
                const reloadBtn = document.querySelector('#mcp-reload-btn')
                reloadBtn.style.display = 'block'
                reloadBtn.onclick = async function() {
                    
                    this.disabled = true
                    this.innerText = '加载中...'
                    
                    try {
                        document.querySelector("#reload_tips").innerText = "加载中..."
                        const res = await axios.post('/api/mcp/reload')
                        if (res.data.code === 1) {
                            alert(res.data.msg)
                            loadMcpServers(container)
                        } else {
                            alert('重新加载失败: ' + res.data.msg)
                        }
                    } catch (err) {
                        console.error('重新加载失败:', err)
                        alert('重新加载失败，请查看控制台')
                    } finally {
                        document.querySelector("#reload_tips").innerText = ""
                        this.disabled = false
                        this.innerText = '重新加载'
                    }
                }
                
                // 获取已加载的工具信息
                const loadedResponse = await axios.get('/api/mcp')
                let loadedToolsData = {}
                if (loadedResponse.data.code === 1) {
                    loadedToolsData = loadedResponse.data.data
                }
                    
                    // 遍历每个服务
                    serversData.forEach(serverData => {
                        const serviceName = serverData.server_id
                        const serviceTools = loadedToolsData[serviceName] || {}
                        
                        // 创建服务容器
                        const serviceDiv = document.createElement('div')
                        serviceDiv.className = 'mcp-service-container'
                        serviceDiv.style.marginBottom = '20px'
                        serviceDiv.style.padding = '15px'
                        serviceDiv.style.border = '1px solid #ddd'
                        serviceDiv.style.borderRadius = '8px'
                        serviceDiv.style.backgroundColor = '#f9f9f9'
                        
                        // 服务标题行（包含按钮和标题）
                        const serviceTitleRow = document.createElement('div')
                        serviceTitleRow.style.display = 'flex'
                        serviceTitleRow.style.alignItems = 'center'
                        serviceTitleRow.style.justifyContent = 'space-between'
                        serviceTitleRow.style.marginBottom = '15px'
                        
                        // 左侧：展开按钮 + 标题
                        const leftSide = document.createElement('div')
                        leftSide.style.display = 'flex'
                        leftSide.style.alignItems = 'center'
                        leftSide.style.cursor = 'pointer'
                        leftSide.style.userSelect = 'none'
                        leftSide.style.flex = '1'
                        
                        // 展开/收起按钮（默认收起状态）
                        const toggleBtn = document.createElement('span')
                        toggleBtn.className = 'mcp-toggle-btn'
                        toggleBtn.innerHTML = '▼'
                        toggleBtn.style.fontSize = '14px'
                        toggleBtn.style.color = '#666'
                        toggleBtn.style.transition = 'transform 0.3s ease'
                        toggleBtn.style.display = 'inline-block'
                        toggleBtn.style.marginRight = '10px'
                        toggleBtn.style.minWidth = '16px'
                        toggleBtn.style.transform = 'rotate(-90deg)'
                        leftSide.appendChild(toggleBtn)
                        
                        // 服务标题
                        const serviceTitle = document.createElement('h3')
                        serviceTitle.innerText = serviceName
                        serviceTitle.style.margin = '0'
                        serviceTitle.style.color = serverData.enabled ? '#333' : '#999'
                        serviceTitle.style.fontSize = '18px'
                        leftSide.appendChild(serviceTitle)
                        
                        // 状态标签
                        const statusBadge = document.createElement('span')
                        statusBadge.style.marginLeft = '10px'
                        statusBadge.style.padding = '2px 8px'
                        statusBadge.style.borderRadius = '3px'
                        statusBadge.style.fontSize = '12px'
                        statusBadge.style.fontWeight = 'normal'
                        if (serverData.is_loaded) {
                            statusBadge.innerText = '已加载'
                            statusBadge.style.backgroundColor = '#d4edda'
                            statusBadge.style.color = '#155724'
                        } else if (serverData.enabled) {
                            statusBadge.innerText = '未加载'
                            statusBadge.style.backgroundColor = '#fff3cd'
                            statusBadge.style.color = '#856404'
                        } else {
                            statusBadge.innerText = '已禁用'
                            statusBadge.style.backgroundColor = '#f8d7da'
                            statusBadge.style.color = '#721c24'
                        }
                        leftSide.appendChild(statusBadge)
                        
                        serviceTitleRow.appendChild(leftSide)
                        
                        // 右侧：删除按钮 + 启用/禁用开关
                        const rightSide = document.createElement('div')
                        rightSide.style.display = 'flex'
                        rightSide.style.alignItems = 'center'
                        rightSide.style.gap = '10px'
                        
                        // 删除按钮
                        const deleteBtn = document.createElement('button')
                        deleteBtn.innerText = '删除'
                        deleteBtn.style.padding = '4px 12px'
                        deleteBtn.style.fontSize = '13px'
                        deleteBtn.style.backgroundColor = '#dc3545'
                        deleteBtn.style.color = 'white'
                        deleteBtn.style.border = 'none'
                        deleteBtn.style.borderRadius = '4px'
                        deleteBtn.style.cursor = 'pointer'
                        deleteBtn.style.transition = 'background-color 0.2s'
                        deleteBtn.onmouseover = () => deleteBtn.style.backgroundColor = '#c82333'
                        deleteBtn.onmouseout = () => deleteBtn.style.backgroundColor = '#dc3545'
                        deleteBtn.onclick = async function(e) {
                            e.stopPropagation()
                            if (!confirm(`确定要删除服务器 "${serviceName}" 吗？\n删除后需要重新加载才能生效。`)) {
                                return
                            }
                            
                            deleteBtn.disabled = true
                            deleteBtn.innerText = '删除中...'
                            
                            try {
                                const res = await axios.delete(`/api/mcp/delete/${serviceName}`)
                                if (res.data.code === 1) {
                                    alert(res.data.msg)
                                    // 重新加载列表
                                    loadMcpServers(container)
                                } else {
                                    alert('删除失败: ' + res.data.msg)
                                    deleteBtn.disabled = false
                                    deleteBtn.innerText = '删除'
                                }
                            } catch (err) {
                                console.error('删除失败:', err)
                                alert('删除失败，请查看控制台')
                                deleteBtn.disabled = false
                                deleteBtn.innerText = '删除'
                            }
                        }
                        rightSide.appendChild(deleteBtn)
                        
                        // 启用/禁用开关
                        const toggleSwitch = document.createElement('label')
                        toggleSwitch.className = 'switch'
                        
                        const switchInput = document.createElement('input')
                        switchInput.type = 'checkbox'
                        switchInput.checked = serverData.enabled
                        switchInput.dataset.serverId = serviceName
                        
                        const switchSlider = document.createElement('span')
                        switchSlider.className = 'slider'
                        
                        toggleSwitch.appendChild(switchInput)
                        toggleSwitch.appendChild(switchSlider)
                        rightSide.appendChild(toggleSwitch)
                        
                        serviceTitleRow.appendChild(rightSide)
                        
                        // 切换开关事件
                        switchInput.addEventListener('change', async function(e) {
                            e.stopPropagation()  // 防止触发展开/收起
                            const serverId = this.dataset.serverId
                            const newStatus = this.checked
                            
                            this.disabled = true
                            
                            await axios.post(`/api/mcp/toggle/${serverId}`)
                                .then(res => {
                                    if (res.data.code === 1) {
                                        console.log(`${serverId} 状态已切换`)
                                        // 提示需要重新加载
                                        if (confirm(res.data.msg + '\n\n是否现在重新加载？')) {
                                            document.querySelector("#reload_tips").innerText = "加载中..."
                                            axios.post('/api/mcp/reload').then(() => {
                                                loadMcpServers(container)
                                                document.querySelector("#reload_tips").innerText = ""
                                            })
                                        }
                                    } else {
                                        alert('切换失败: ' + res.data.msg)
                                        this.checked = !newStatus
                                    }
                                })
                                .catch(err => {
                                    console.error('切换失败:', err)
                                    alert('切换失败')
                                    this.checked = !newStatus
                                })
                                .finally(() => {
                                    this.disabled = false
                                })
                        })
                        
                        serviceDiv.appendChild(serviceTitleRow)
                        
                        // 工具列表容器（默认收起）
                        const toolsContainer = document.createElement('div')
                        toolsContainer.className = 'mcp-tools-container'
                        toolsContainer.style.maxHeight = '0px'
                        toolsContainer.style.overflow = 'hidden'
                        toolsContainer.style.transition = 'max-height 0.3s ease, opacity 0.3s ease'
                        toolsContainer.style.opacity = '0'
                        
                        // 遍历该服务的工具（如果有）
                        if (Object.keys(serviceTools).length > 0) {
                            Object.keys(serviceTools).forEach(toolName => {
                                const tool = serviceTools[toolName]
                            
                            const toolDiv = document.createElement('div')
                            toolDiv.style.marginBottom = '15px'
                            toolDiv.style.padding = '12px'
                            toolDiv.style.backgroundColor = '#fff'
                            toolDiv.style.border = '1px solid #e0e0e0'
                            toolDiv.style.borderRadius = '5px'
                            
                            // 工具名称
                            const toolNameDiv = document.createElement('div')
                            toolNameDiv.style.fontWeight = 'bold'
                            toolNameDiv.style.color = '#0066cc'
                            toolNameDiv.style.marginBottom = '8px'
                            toolNameDiv.style.fontSize = '14px'
                            toolNameDiv.innerText = tool.name
                            toolDiv.appendChild(toolNameDiv)
                            
                            // 工具描述
                            if (tool.description) {
                                const descDiv = document.createElement('div')
                                descDiv.style.color = '#666'
                                descDiv.style.marginBottom = '8px'
                                descDiv.style.fontSize = '13px'
                                descDiv.style.lineHeight = '1.5'
                                descDiv.style.whiteSpace = 'pre-wrap'
                                descDiv.innerText = tool.description
                                toolDiv.appendChild(descDiv)
                            }
                            
                            // 参数信息
                            if (tool.parameters && tool.parameters.properties) {
                                const paramsDiv = document.createElement('div')
                                paramsDiv.style.marginTop = '8px'
                                paramsDiv.style.fontSize = '12px'
                                paramsDiv.style.color = '#555'
                                
                                const paramsTitle = document.createElement('div')
                                paramsTitle.style.fontWeight = 'bold'
                                paramsTitle.style.marginBottom = '5px'
                                paramsTitle.innerText = '参数:'
                                paramsDiv.appendChild(paramsTitle)
                                
                                const paramsList = document.createElement('ul')
                                paramsList.style.margin = '0'
                                paramsList.style.paddingLeft = '20px'
                                
                                Object.keys(tool.parameters.properties).forEach(paramName => {
                                    const param = tool.parameters.properties[paramName]
                                    const paramItem = document.createElement('li')
                                    paramItem.style.marginBottom = '3px'
                                    const required = tool.parameters.required && tool.parameters.required.includes(paramName) ? ' (必需)' : ' (可选)'
                                    paramItem.innerHTML = `<span style="color: #0066cc;">${paramName}</span>: ${param.type || 'any'}${required}`
                                    paramsList.appendChild(paramItem)
                                })
                                
                                paramsDiv.appendChild(paramsList)
                                toolDiv.appendChild(paramsDiv)
                            }
                            
                                toolsContainer.appendChild(toolDiv)
                            })
                        } else {
                            // 如果没有工具，显示提示
                            const noToolsDiv = document.createElement('div')
                            noToolsDiv.style.padding = '12px'
                            noToolsDiv.style.color = '#999'
                            noToolsDiv.style.fontSize = '13px'
                            noToolsDiv.style.textAlign = 'center'
                            noToolsDiv.innerText = serverData.enabled ? '服务未加载或无可用工具' : '服务已禁用'
                            toolsContainer.appendChild(noToolsDiv)
                        }
                        
                        serviceDiv.appendChild(toolsContainer)
                        
                        // 添加点击事件：收起/展开（只在左侧区域触发）
                        leftSide.addEventListener('click', function() {
                            const isCollapsed = toolsContainer.style.maxHeight === '0px'
                            
                            if (isCollapsed) {
                                // 展开
                                toolsContainer.style.maxHeight = '2000px'
                                toolsContainer.style.opacity = '1'
                                toggleBtn.style.transform = 'rotate(0deg)'
                            } else {
                                // 收起
                                toolsContainer.style.maxHeight = '0px'
                                toolsContainer.style.opacity = '0'
                                toggleBtn.style.transform = 'rotate(-90deg)'
                            }
                        })
                        
                        container.appendChild(serviceDiv)
                    })
                    
                // 如果没有服务
                if (serversData.length === 0) {
                    container.innerHTML += '<div style="text-align: center; padding: 20px; color: #999;">暂无MCP服务器配置</div>'
                }
            } else {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: #f00;">${response.data.msg || '加载失败'}</div>`
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        } catch (error) {
            console.error('请求出错:', error)
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #f00;">加载失败，请检查网络连接</div>'
        }
    }

    document.querySelector("#global-setting").addEventListener("click", async function (e) {
        e.preventDefault()
        open_setting_box(document.querySelector('.global-setting-box'))


        document.querySelectorAll('.global-setting-box input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = localStorage.getItem('on_' + checkbox.id.replace('-check', '')) !== 'false'
        })

        document.querySelector('.global-setting-box').addEventListener('change', e => {
            if (e.target.matches('input[type="checkbox"]')) {
                const id = e.target.id.replace('-check', '') // markdown / moreinfo / ...
                localStorage.setItem('on_' + id, e.target.checked)
            }
        })

    })


    await update_task_list(global_last_task_id)

    const chatHistoryList = document.querySelector("#chat-history-list")
    setTimeout(() => {
        let can_loading = 1
        // 添加滚动事件监听
        chatHistoryList.addEventListener('scroll', async function () {
            const distanceToBottom = chatHistoryList.scrollHeight - chatHistoryList.scrollTop - chatHistoryList.clientHeight
            if (distanceToBottom <= 100 && can_loading === 1 && global_last_task_id >= 0) {
                can_loading = 0
                await update_task_list(global_last_task_id)
                can_loading = 1
            }
        })
    },5)

    if (window.location.pathname.split('/').filter(Boolean).pop()) {
        load_history(localStorage.getItem('lastsessid'))
    } else {
        const lastsessid = localStorage.getItem('lastsessid')
        if (lastsessid) {
            history.pushState(null, '', `/chat/${lastsessid}`)
            load_history(lastsessid)
        }
    }

    //初始化选中对话特殊显示
    const path = window.location.pathname
    const session_id = path.split('/').filter(Boolean).pop()
    const chat_menu = document.querySelectorAll("#chat-history-list a")
    chat_menu.forEach(chat => {
        if (chat.href.split('/').filter(Boolean).pop() === session_id)
            chat.classList.add('tasking')
    })

    // 初始化回到底部按钮
    initScrollToBottomButton()

})()


// 自动高度调整和长度限制
chatInput.addEventListener('input', function () {
    // 限制最大高度
    this.style.height = 'auto'
    if (this.scrollHeight <= 320) {
        this.style.height = this.scrollHeight + 'px'
    } else {
        this.style.height = '320px'
    }
})

// 发送消息逻辑
sendBtn.onclick = () => {

    const text = chatInput.value.trim()

    if (text) {
        //发送数据到主区域
        const userDiv = document.querySelector("#source .c-user").cloneNode(true)
        userDiv.querySelector(".content").innerText = text
        document.querySelector("#chat-in").appendChild(userDiv)
        chatInput.value = ""
        chatInput.style = "height: 63px;"
        //顺滑滚动到底部
        document.querySelector("#chat-area").scrollTo({
            top: document.querySelector("#chat-area").scrollHeight,
            behavior: 'smooth'
        })

        update_msg(userDiv)
        // 自动标题
        if(document.querySelector("#chat-in").children.length <= 3 && localStorage.getItem('on_auto_title') !== 'false'){
            auto_ai_title(text)
        }
        send_msg(userDiv)  // 传递userDiv，出错时回退这条消息
        // 发送消息后检查按钮状态（虽然通常会滚动到底部，但确保按钮隐藏）
        setTimeout(() => checkScrollToBottomButton(), 200)
        sendBtn.classList.add('stoptype')
        sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" rx="3" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
    else if(sendBtn.classList.contains('stoptype')){
        sendBtn.classList.remove('stoptype')
        sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 6V42" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 18L24 6L36 18" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        sseController.abort()
        const assistant_boxs = document.querySelectorAll('#chat-in .c-assistant')
        const assistant_box = assistant_boxs[assistant_boxs.length - 1]
        renderAssistantContent(assistant_box.querySelector(".content"), last_assistant_yuan)
        assistant_box.querySelector(".assistant-group").style.display = "flex"
        //将中断的ai回复同步服务器
        update_msg(assistant_box)
        setTimeout(() => {
                console.log("SSE上一个连接已终止")
            }, 50)
    }


}

//回车发送
chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendBtn.click()
    }
})



//主区域事件委托监听

//处理鼠标悬浮提示
chatIn.addEventListener('mouseover', function (e) {
    const target = e.target.closest('.copy, .user-edit, .try-again')
    if (target && chatIn.contains(target)) {
        const text = target.getAttribute('aria-label')
        if (!text) return
        tooltip.textContent = text
        const rect = target.getBoundingClientRect()
        tooltip.style.left = rect.left + window.scrollX + rect.width / 2 + 'px'
        tooltip.style.top = rect.bottom + window.scrollY + 8 + 'px'
        tooltip.style.transform = 'translateX(-50%)'
        tooltip.style.opacity = 1
    }
})

chatIn.addEventListener('mouseout', function (e) {
    const target = e.target.closest('.copy, .user-edit, .try-again')
    if (target && chatIn.contains(target)) {
        tooltip.style.opacity = 0
    }
})



chatIn.addEventListener('click', async function (e) {
    if (e.target.closest('.copy')) {
        const copy_box = e.target.closest('.copy')
        // 检查是否是代码块复制按钮
        if (copy_box.classList.contains('code-copy-btn')) {
            const code = copy_box.parentElement.querySelector('code')
            if (code) {
                copyText(code.textContent)
            }
        } else {
            copyText(msg_list[e.target.closest('.c-user, .c-assistant').dataset.id]["content"])
        }
        copy_box.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 24L20 34L40 14" stroke="#5d5d5d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        setTimeout(() => {
            copy_box.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163"
                                stroke="#5d5d5d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z"
                                fill="none" stroke="#5d5d5d" stroke-width="3" stroke-linejoin="round" />
                        </svg>`
        }, 2000)
    }
    else if (e.target.closest('.check-button')) {
        const check_button = e.target.closest('.check-button')
        let check_id = check_button.dataset.id
        let chat_box = check_button.closest('.c-user, .c-assistant')
        if (check_id !== "null") {
            let next = chat_box.nextElementSibling
            while (next) {
                let tmp = next.nextElementSibling // 先保存下一个
                next.remove() // 删除当前
                next = tmp // 继续
            }
            chat_box.remove() // 最后删除自身


            const chat_main = document.querySelector("#chat-in")
            const copy_user = document.querySelector("#source .c-user")
            const copy_assistant = document.querySelector("#source .c-assistant")
            const copy_tools = document.querySelector('#source .tools-call-box')

            while (check_id) {
                if (msg_list[check_id].role === "user") {
                    const user_node = copy_user.cloneNode(true)
                    user_node.querySelector(".content").innerText = msg_list[check_id].content
                    user_node.dataset.id = check_id
                    chat_main.appendChild(user_node)
                } else if (msg_list[check_id].role === "assistant") {
                    const assistant_node = copy_assistant.cloneNode(true)
                    renderAssistantContent(assistant_node.querySelector(".content"), msg_list[check_id].content)
                    if(msg_list[check_id].more_info)
                        assistant_node.querySelector(".assistant-more-info").innerText = `used tokens:${msg_list[check_id].more_info.used_token ? msg_list[check_id].more_info.used_token : NULL}, model:${msg_list[check_id].more_info.model ? msg_list[check_id].more_info.model : NULL}`
                    if (! (localStorage.getItem("on_moreinfo") !== 'false'))
                        assistant_node.querySelector(".assistant-more-info").style.display = "none"
                    assistant_node.dataset.id = check_id
                    //加载工具显示
                    if ("tool_return" in msg_list[check_id]) {
                        //将工具响应数据存在字典内备用
                        tools_menu[msg_list[check_id].tool_return.tool_call_id] = msg_list[check_id].tool_return.content
                    }
                    if (msg_list[check_id].tool_calls) {
                        //一般只会有一条数据进入循环，为之后扩展做准备
                        msg_list[check_id].tool_calls.forEach(tool => {
                            const tool_node = copy_tools.cloneNode(true)
                            tool_node.querySelector(".tools-call-name .tools-content").innerText = tool.function.name
                            tool_node.querySelector(".tools-call-params .tools-content").innerText = tool.function.arguments
                            tool_node.querySelector(".tools-call-id .tools-content").innerText = tool.id
                            if (tools_menu[tool.id]) {
                                tool_node.querySelector(".tools-call-return .tools-content").innerText = tools_menu[tool.id]
                                tool_node.querySelector(".tools-call-return").style.display = "block"
                            }
                            assistant_node.insertBefore(tool_node, assistant_node.children[1])
                        })
                    }
                    chat_main.appendChild(assistant_node)
                }

                const last_msg_id = msg_list[check_id].parent_id
                if (last_msg_id) {
                    const children_list = msg_list[last_msg_id].children
                    if (children_list.length > 1) {
                        const total = children_list.length
                        const index = children_list.indexOf(check_id)
                        const position = index + 1
                        const prev = children_list[index - 1] !== undefined ? children_list[index - 1] : null
                        const next = children_list[index + 1] !== undefined ? children_list[index + 1] : null

                        const chat_tree = document.querySelector("#source #chat-tree").cloneNode(true)
                        const check_buttons = chat_tree.querySelectorAll(".check-button")
                        check_buttons[0].dataset.id = prev
                        check_buttons[1].dataset.id = next
                        chat_tree.querySelector("#check-content").innerText = `${position}/${total}`

                        if (chat_main.lastElementChild.className === "c-user") {
                            chat_main.lastElementChild.lastElementChild.appendChild(chat_tree)
                        } else {
                            chat_main.lastElementChild.lastElementChild.prepend(chat_tree)
                        }

                    }
                }

                check_id = msg_list[check_id].children[0]
            }
        }
    }
    else if (e.target.closest('.try-again')) {
        const target = e.target.closest('.try-again')
        if (target && chatIn.contains(target)) {
            tooltip.style.opacity = 0
        }
        const chat_box = e.target.closest('.c-user, .c-assistant')
        const last_msg_id = chat_box.previousElementSibling.dataset.id

        let next = chat_box.nextElementSibling
        while (next) {
            let tmp = next.nextElementSibling // 先保存下一个
            next.remove() // 删除当前
            next = tmp // 继续
        }
        chat_box.remove() // 最后删除自身
        setTimeout(() => checkScrollToBottomButton(), 200)
        sendBtn.classList.add('stoptype')
        sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" rx="3" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

        await send_msg(null)  // try-again不需要回退，用户消息已存在

        const chat_main = document.querySelector("#chat-in")
        const find_uuid = chat_main.lastElementChild.dataset.id
        if (last_msg_id) {
            const children_list = msg_list[last_msg_id].children
            if (children_list.length > 1) {
                const total = children_list.length
                const index = children_list.indexOf(find_uuid)
                const position = index + 1
                const prev = children_list[index - 1] !== undefined ? children_list[index - 1] : null
                const next = children_list[index + 1] !== undefined ? children_list[index + 1] : null

                const chat_tree = document.querySelector("#source #chat-tree").cloneNode(true)
                const check_buttons = chat_tree.querySelectorAll(".check-button")
                check_buttons[0].dataset.id = prev
                check_buttons[1].dataset.id = next
                chat_tree.querySelector("#check-content").innerText = `${position}/${total}`

                if (chat_main.lastElementChild.className === "c-user") {
                    chat_main.lastElementChild.lastElementChild.appendChild(chat_tree)
                } else {
                    chat_main.lastElementChild.lastElementChild.prepend(chat_tree)
                }
            }
        }

    }
    else if (e.target.closest('.user-edit')){
        const target = e.target.closest('.user-edit')
        if (target && chatIn.contains(target)) {
            tooltip.style.opacity = 0
        }

        const user_box = e.target.closest('.c-user')
        const edit_msg_box = document.querySelector("#source #edit-msg-box").cloneNode(true)
        edit_msg_box.querySelector("#edit-msg").value = user_box.querySelector(".content").innerText
        user_box.appendChild(edit_msg_box)
        user_box.querySelector(".content").style.display = "none"
        user_box.querySelector(".user-group").style.display = "none"
        edit_msg_box.querySelector(".edit-buttons .edit-cancel").addEventListener("click",function (e){
            edit_msg_box.remove()
            user_box.querySelector(".content").style.display = "block"
            user_box.querySelector(".user-group").style.display = "flex"
        })
        edit_msg_box.querySelector(".edit-buttons .edit-send").addEventListener("click",async function (e) {
            const chat_box = e.target.closest('.c-user')
            const last_msg_id = chat_box.previousElementSibling.dataset.id

            let next = chat_box.nextElementSibling
            while (next) {
                let tmp = next.nextElementSibling // 先保存下一个
                next.remove() // 删除当前
                next = tmp // 继续
            }

            //发送数据到主区域
            const userDiv = document.querySelector("#source .c-user").cloneNode(true)
            userDiv.querySelector(".content").innerText = edit_msg_box.querySelector("#edit-msg").value
            document.querySelector("#chat-in").appendChild(userDiv)
            //顺滑滚动到底部
            document.querySelector("#chat-area").scrollTo({
                top: document.querySelector("#chat-area").scrollHeight,
                behavior: 'smooth'
            })

            user_box.remove()

            await update_msg(userDiv)
            // 编辑消息后检查按钮状态
            setTimeout(() => checkScrollToBottomButton(), 200)

            const chat_main = document.querySelector("#chat-in")
            const find_uuid = chat_main.lastElementChild.dataset.id
            if (last_msg_id) {
                const children_list = msg_list[last_msg_id].children
                if (children_list.length > 1) {
                    const total = children_list.length
                    const index = children_list.indexOf(find_uuid)
                    const position = index + 1
                    const prev = children_list[index - 1] !== undefined ? children_list[index - 1] : null
                    const next = children_list[index + 1] !== undefined ? children_list[index + 1] : null

                    const chat_tree = document.querySelector("#source #chat-tree").cloneNode(true)
                    const check_buttons = chat_tree.querySelectorAll(".check-button")
                    check_buttons[0].dataset.id = prev
                    check_buttons[1].dataset.id = next
                    chat_tree.querySelector("#check-content").innerText = `${position}/${total}`

                    if (chat_main.lastElementChild.className === "c-user") {
                        chat_main.lastElementChild.lastElementChild.appendChild(chat_tree)
                    } else {
                        chat_main.lastElementChild.lastElementChild.prepend(chat_tree)
                    }
                }
            }
            setTimeout(() => checkScrollToBottomButton(), 200)
            sendBtn.classList.add('stoptype')
            sendBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="36" height="36" rx="3" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

            await send_msg(userDiv)  // 传递userDiv，出错时回退这条消息

        })
    }
    else if (e.target.closest('.tools-toggle-btn')){
        const box = e.target.closest('.tools-call-box')
        box.classList.toggle('expanded')
        e.target.closest('.tools-toggle-btn').textContent = box.classList.contains('expanded') ? '收起' : '展开'
    }

})

