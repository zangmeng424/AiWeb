import {fetchEventSource} from "/static/js/esm.js"


let msg_list = {} //全局消息列表，存储当前加载对话的所有对话内容，及之后更新的新消息
const chatInput = document.querySelector('#chat-input')
const sendBtn = document.querySelector('#send-btn')
const MAX_LENGTH = 1000
const tooltip = document.getElementById('tips')
const chatIn = document.getElementById('chat-in')
var sseController = null  // SSE 全局控制器


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
                response.data.data.forEach(model_son =>{
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

                response.data.data.model

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
                setbox.querySelector("#max_take").value = model_son.max_take
                setbox.querySelector("#max_take_in").value = model_son.max_take
                setbox.querySelector("#temperature").value = model_son.temperature
                setbox.querySelector("#temperature_in").value = model_sona.temperature
                setbox.querySelector("#top_p").value = model_son.top_p
                setbox.querySelector("#top_p_in").value = model_son.top_p
            }
        })

    })
}

function ch_put(sessid) {
    //TODO
    //导出对话

    alert(sessid)
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
                session_id: window.location.pathname.split('/').filter(Boolean).pop(),
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

function load_history(sessid){

    if (!sessid) return

    axios.get('/api/chat/history', {
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
                    else if (item.role === "assistant") {
                        const assistant_node = copy_assistant.cloneNode(true)

                        last_msg_id = item.parent_id
                        assistant_node.querySelector(".content").innerText = item.content
                        assistant_node.querySelector(".assistant-more-info").innerText = `used tokens:${item.more_info.used_token ? item.more_info.used_token : NULL}, model:${item.more_info.model ? item.more_info.model : NULL}`
                        assistant_node.dataset.id = find_uuid
                        //加载工具显示
                        if ("tool_return" in item) {
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
                let tools_menu = {}

                while (last_msg_id){
                    last_msg_id = load_msg(last_msg_id)
                }



                //系统提示词加载
                chat_main.prepend(document.querySelector("#source .c-system").cloneNode(true))
                chat_main.querySelector(".c-system .content").innerText = response.data.system
                listen_system()

                chat_main.parentNode.scrollTop = chat_main.parentNode.scrollHeight  // 立即滚动到底

            }
            else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })

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
async function send_msg() {
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
    const path = window.location.pathname
    const session_id = path.split('/').filter(Boolean).pop()
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

    return fetchEventSource("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({session_id: session_id, data: task_data}),
        signal,
        onopen(response) {
            if (response.ok && response.status === 200) return;
            throw new Error("非正常响应，终止连接");
        },
        onmessage(ev) {
            if (ev.event === "start") {
                document.querySelector("#chat-in").appendChild(assistantDiv)
            }
            else if (ev.event === "finish") {
                assistantDiv.querySelector(".assistant-group").style.display = "flex"
                update_msg(assistantDiv)
                sseController = null
                //检查是否存在tools_call
                const tools_box = assistantDiv.querySelector(".tools-call-box")
                if (tools_box) {
                    tools_box.querySelector(".tools-call-actions").style.display = "flex"

                    //存在工具调用请求则给两个按钮绑定事件
                    tools_box.querySelector(".btn-cancel").addEventListener("click", function () {
                        tools_box.remove()
                    })
                    tools_box.querySelector(".btn-confirm").addEventListener("click", function () {
                        tools_box.querySelector(".tools-call-actions").remove()
                        axios.post('/api/chat/tools', {
                            tools_call_name: tools_box.querySelector(".tools-call-name .tools-content").innerText,
                            tools_call_params: tools_box.querySelector(".tools-call-params .tools-content").innerText,
                        })
                            .then(response => {
                                // 获取返回的 JSON 数据
                                console.log(response.data)
                                if (response.data.code === 1) {
                                    //获取到工具响应结果
                                    tools_box.querySelector(".tools-call-return .tools-content").innerText = response.data.data
                                    tools_box.querySelector(".tools-call-return").style.display = "block"
                                    update_msg(tools_box)
                                    //二次消息发送
                                    send_msg()


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
                }

            }
            else {
                //拼接AI信息
                const data = JSON.parse(ev.data)
                if (data.choices?.[0]?.delta?.content) {
                    assistantDiv.querySelector(".content").innerText += data.choices[0].delta.content
                    if (data.choices[0].finish_reason === "stop") {
                        assistantDiv.querySelector(".assistant-more-info").innerText = `used tokens: ${data.usage.total_tokens},model: ${data.model}`
                    }
                }
                else if (data.choices?.[0]?.delta?.tool_calls) {
                    if (data.choices[0].delta.tool_calls[0].id) {
                        const tool_call_id = data.choices[0].delta.tool_calls[0].id
                        const tool_call_name = data.choices[0].delta.tool_calls[0].function.name
                        const tool_call_box = document.querySelector('#source .tools-call-box').cloneNode(true)
                        assistantDiv.insertBefore(tool_call_box, assistantDiv.children[1])
                        tool_call_box.querySelector(".tools-call-name .content").innerText = tool_call_name
                        tool_call_box.querySelector(".tools-call-id .content").innerText = tool_call_id
                    }
                    else {
                        tool_call_box.querySelector(".tools-call-params .content").innerText += data.choices[0].delta.tool_calls[0].function.arguments
                    }
                }

                setTimeout(() => {
                    chat_area.scrollTop = chat_area.scrollHeight
                }, 0)

            }
        },
        onerror(err) {
            console.log("\nSSE[出错] " + err + "\n")
            throw err;
        },
        onclose() {

            console.log("\n[连接关闭]\n")
        }
    });

}

//更新记录
async function update_msg(element){
    if (!(element instanceof HTMLElement)) {
        console.error("参数不是一个有效的HTML元素")
        return
    }
    const path = window.location.pathname
    const session_id = path.split('/').filter(Boolean).pop()

    const msg = {
        session_id: session_id,
        created_at: ~~(Date.now() / 1000),
    }

    if (element.className === "tools-call-box"){
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

function update_task_list(){
    //初始化 AI对话列表
    const chatHistoryList = document.querySelector("#chat-history-list")
    chatHistoryList.innerText = ""
    axios.get('/api/task/list')
        .then(response => {
            const res = response.data
            if (res.code === 1) {
                // 提取 data 数组里的 title、id、session_id
                res.data.forEach(item => {
                    chatHistoryList.innerHTML += `<a class="sidebar-btn-hover sidebar-entry" href="/chat/${item.session_id}" data-id="${item.session_id}">
                                                    <div class="sidebar-entry-txt">${item.title}</div>
                                                  </a>`
                })

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
                                // 定位到 chatSetting 下方
                                popup.style.position = 'absolute'
                                popup.style.left = chatSetting.offsetLeft + chatSetting.offsetWidth - 30 + 'px'
                                popup.style.top = chatSetting.offsetTop + chatSetting.offsetHeight + 'px'
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
                            const old_session_id = window.location.pathname.split('/').filter(Boolean).pop()
                            if (old_session_id !== session_id){//防止重复加载
                                // 更新地址栏地址
                                history.pushState(null, '', `/chat/${session_id}`)
                                load_history(session_id)
                            }
                            localStorage.setItem('lastsessid', session_id)
                        }
                    })
                 })
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
                session_id:window.location.pathname.split('/').filter(Boolean).pop()
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

//页面初始化
!(function () {
    //初始组建绑定
    document.querySelector("#new-chat").addEventListener("click",async function (e) {
        e.preventDefault()

        await add_new_task()

        location.reload(true)

    })

    document.querySelector("#knowledge-setting").addEventListener("click",async function (e) {
        e.preventDefault()

        document.body.classList.add('mask')
        const setbox = document.querySelector('.knowledge-setting-box')
        const setbox_main = setbox.querySelector("#chatset")
        setbox_main.innerHTML = `<div class="knowledge—list"> <div class="knowledge—list-content" contenteditable="true"> </div><button id="setbox-save">保存</button></div>`

        setbox.style.display = "block"
        setTimeout(() => {
            setbox.classList.add('active')
        }, 10)

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

    document.querySelector("#model-setting").addEventListener("click",async function (e){
        e.preventDefault()
        document.body.classList.add('mask')
        const setbox = document.querySelector('.model-setting-box')
        setbox.querySelector("#model-name").value = ""
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
                const chat_model = document.getElementById('model-name-list')
                chat_model.innerHTML = ''
                response.data.data.forEach(model_son =>{
                    const opt = document.createElement('option')
                    opt.value = model_son.model_name
                    chat_model.appendChild(opt)
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
            model_data.forEach(model_son =>{
                if (e.target.value === model_son.model_name){
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
                }else{
                    setbox.querySelector("#model-uuid").innerText = ""
                }

            })
        })
    })

    update_task_list()

    if (window.location.pathname.split('/').filter(Boolean).pop()){
        const path = window.location.pathname
        const session_id = path.split('/').filter(Boolean).pop()
        load_history(session_id)
    }
    else{
        const lastsessid=localStorage.getItem('lastsessid')
        if (lastsessid){
            history.pushState(null, '', `/chat/${lastsessid}`)
            load_history(lastsessid)
        }

    }

})()


// 自动高度调整和长度限制
chatInput.addEventListener('input', function () {
    // 限制最大长度
    if (this.value.length > MAX_LENGTH) {
        this.value = this.value.slice(0, MAX_LENGTH)
    }
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
        //顺滑滚动到底部
        document.querySelector("#chat-area").scrollTo({
            top: document.querySelector("#chat-area").scrollHeight,
            behavior: 'smooth'
        })

        update_msg(userDiv)

        send_msg()

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
    const target = e.target.closest('.copy, .user-edit, .try-again, .check-button')
    if (target && chatIn.contains(target)) {
        if (e.target.closest('.copy')) {
            const copy_box = e.target.closest('.copy')
            copyText(e.target.closest('.c-user, .c-assistant').querySelector(".content").innerText)
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
                        assistant_node.querySelector(".content").innerText = msg_list[check_id].content
                        assistant_node.querySelector(".assistant-more-info").innerText = `used tokens:${msg_list[check_id].more_info.used_token ? msg_list[check_id].more_info.used_token : NULL}, model:${msg_list[check_id].more_info.model ? msg_list[check_id].more_info.model : NULL}`
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

            await send_msg()

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

                await send_msg()

            })
        }
    }
})

