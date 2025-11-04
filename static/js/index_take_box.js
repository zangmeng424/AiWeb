const imageDiv = document.querySelector('.setting-box #imageDiv')
const fileInput = document.querySelector('.setting-box #fileInput')
const displayImage = document.querySelector('.setting-box #displayImage')
//document.getElementById('displayImage').src    图片base64
// 点击div触发文件选择
imageDiv.addEventListener('click', () => {
    fileInput.click()
})

// 选择图片后显示在div里
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = function (e) {
            displayImage.src = e.target.result // 显示选择的图片
            const base64Data = e.target.result // 这里就是 Base64
            console.log(base64Data)
        }
        reader.readAsDataURL(file)
    }
})

// 通用绑定函数
function bindSlider(sliderId, inputId) {
    const slider = document.querySelector(sliderId)
    const input = document.querySelector(inputId)

    // 滑条变化 → 输入框
    slider.addEventListener("input", () => {
        input.value = slider.value
    })

    // 输入框变化 → 滑条
    input.addEventListener("input", () => {
        let val = Number(input.value)
        if (val < slider.min) val = slider.min
        if (val > slider.max) val = slider.max
        slider.value = val
        input.value = val
    })
}

// 绑定滑条
bindSlider(".setting-box #max-take", ".setting-box #max-take-in")
bindSlider(".setting-box #temperature", ".setting-box #temperature-in")
bindSlider(".setting-box #top-p", ".setting-box #top-p-in")

bindSlider(".model-setting-box #max-take", ".model-setting-box #max-take-in")
bindSlider(".model-setting-box #temperature", ".model-setting-box #temperature-in")
bindSlider(".model-setting-box #top-p", ".model-setting-box #top-p-in")

function chatset_save() {
    const setbox = document.querySelector('.setting-box')
    axios.post('/api/setting/task', {
        session_id: setbox.querySelector("#session-id").value,
        task_name: setbox.querySelector("#task-name").value,
        system: setbox.querySelector("#system").value,
        avatar: setbox.querySelector('#displayImage').src,
        model: setbox.querySelector("#chat-model").value,
        max_take: setbox.querySelector("#max-take-in").value,
        temperature: setbox.querySelector("#temperature-in").value,
        top_p: setbox.querySelector("#top-p-in").value
        })
        .then(response => {
            // 获取返回的 JSON 数据
            console.log(response.data)
            if (response.data.code === 1) {
                alert(response.data.msg)
                location.reload(true)
            } else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })

    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function chatset_cancel() {
    const setbox = document.querySelector('.setting-box')
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function model_setting_cancel() {
    const setbox = document.querySelector('.model-setting-box')
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function model_setting_save() {
    const setbox = document.querySelector('.model-setting-box')
    setbox.querySelector("#model-name").value
    if(! setbox.querySelector("#model-uuid").innerText){
        setbox.querySelector("#model-uuid").innerText = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
    }

    axios.post('/api/setting/model',{
        model_uuid: setbox.querySelector("#model-uuid").innerText,
        model_name: setbox.querySelector("#model-name").value,
        model: setbox.querySelector("#model").value,
        system: setbox.querySelector("#system").value,
        max_take: setbox.querySelector("#max-take").value,
        temperature: setbox.querySelector("#temperature").value,
        top_p: setbox.querySelector("#top-p").value,
        base_url: setbox.querySelector("#base-url").value,
        api_key: setbox.querySelector("#api-key").value
    })
        .then(response => {
            // 获取返回的 JSON 数据
            console.log(response.data)
            if (response.data.code === 1) {
                console.log(response.data.msg)
                localStorage.setItem(setbox.querySelector("#model-uuid").innerText, setbox.querySelector("#api-key").value)
                alert(response.data.msg)
            } else {
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })
    model_setting_cancel()
}


function model_setting_del() {
    const setbox = document.querySelector('.model-setting-box')
    if (setbox.querySelector("#model-uuid").innerText){
        axios.get("/api/setting/model/del",{
            params: {
                model_uuid: setbox.querySelector("#model-uuid").innerText
            }
        })
        .then(response => {
            if (response.data.code === 1) {
                console.log(response.data)
                alert(response.data.msg)
            }
            else{
                console.log(response.data.msg)
                alert(response.data.msg)
            }
        })
        .catch(error => {
            // 如果有错误则输出到控制台
            console.error('请求出错:', error)
        })
        model_setting_cancel()
    }
    else{
        alert("请选择模型")
    }

}

function knowledge_setting_cancel() {
    const setbox = document.querySelector('.knowledge-setting-box')
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function global_setting_cancel() {
    const setbox = document.querySelector('.global-setting-box')
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function mcpserver_setting_cancel() {
    const setbox = document.querySelector('.mcpserver-setting-box')
    // 隐藏重新加载按钮
    const reloadBtn = document.querySelector('#mcp-reload-btn')
    if (reloadBtn) reloadBtn.style.display = 'none'
    
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        document.body.classList.remove('mask')
    }, 150)
}

function mcp_add_server_cancel() {
    const setbox = document.querySelector('.mcp-add-server-box')
    setbox.classList.add('fade-out')
    setTimeout(() => {
        setbox.classList.remove('fade-out')
        setbox.style.display = "none"
        // 不要移除mask，因为下层的mcpserver-setting-box还在显示
        // document.body.classList.remove('mask')
        // 清空输入框
        document.querySelector('#mcp-server-json').value = ''
    }, 150)
}

document.querySelector('.knowledge-setting-box #chatset').addEventListener("click", function (e) {
    const target = e.target.closest('#setbox-del,#setbox-save')
    const setbox_main = document.querySelector('.knowledge-setting-box #chatset')
    if (target && document.querySelector('.knowledge-setting-box #chatset').contains(target)) {
        const knowledge_list = e.target.closest('.knowledge—list')
        const text = knowledge_list.querySelector(".knowledge—list-content").innerText
        if (e.target.closest('#setbox-del')) {
            axios.get('/api/knowledge/del',{
                 params: {
                    text: text,
                }
            })
            .then(response => {
                // 获取返回的 JSON 数据
                console.log(response.data)
                if (response.data.code === 1) {
                    alert(response.data.msg)
                    knowledge_list.remove()
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
        else if (e.target.closest('#setbox-save')) {
            axios.get('/api/knowledge/add',{
                 params: {
                    text: text,
                }
            })
            .then(response => {
                // 获取返回的 JSON 数据
                console.log(response.data)
                if (response.data.code === 1) {
                    alert(response.data.msg)
                    knowledge_list.remove()
                    setbox_main.innerHTML += `<div class="knowledge—list"> <div class="knowledge—list-content">${text}</div> <button id="setbox-del">删除</button></div>`
                    setbox_main.innerHTML += `<div class="knowledge—list"> <div class="knowledge—list-content" contenteditable="true"> </div><button id="setbox-save">保存</button></div>`
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


    }
})

document.querySelector('.setting-box #setbox-cancel').addEventListener("click", chatset_cancel)
document.querySelector('.setting-box #setbox-save').addEventListener("click", chatset_save)
document.querySelector('.model-setting-box #setbox-del').addEventListener("click", model_setting_del)
document.querySelector('.model-setting-box #setbox-save').addEventListener("click", model_setting_save)
document.querySelector('.model-setting-box #setbox-cancel').addEventListener("click", model_setting_cancel)
document.querySelector('.knowledge-setting-box #setbox-cancel').addEventListener("click", knowledge_setting_cancel)
document.querySelector('.global-setting-box #setbox-cancel').addEventListener("click", global_setting_cancel)
document.querySelector('.mcpserver-setting-box #setbox-cancel').addEventListener("click", mcpserver_setting_cancel)
document.querySelector('.mcp-add-server-box #mcp-add-cancel').addEventListener("click", mcp_add_server_cancel)



