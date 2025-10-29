const sidebar = document.getElementById("sidebar")
const toggleBtn = document.getElementById("toggle-btn")
const sidebarMask = document.getElementById("global-mask")
const chatHistoryList = document.getElementById('chat-history-list')
let isManualExpand = false
const COLLAPSE_WIDTH = 780


!(function () {
    // 判断开屏页面大小
    const w = window.innerWidth
    if (w < COLLAPSE_WIDTH) sidebar.classList.add("collapsed")
})()

// 侧栏折叠
toggleBtn.addEventListener("click", () => {
    const w = window.innerWidth
    sidebar.classList.toggle("collapsed")
    if (!sidebar.classList.contains("collapsed")) {
        if (w < COLLAPSE_WIDTH) {
            sidebar.classList.add("overlay")
            sidebarMask.style.display = "flex"
            isManualExpand = true
        }
    } else {
        sidebar.classList.remove("overlay")
        sidebarMask.style.display = "none"
    }
})

// 点击遮罩收起侧边栏
sidebarMask.onclick = () => {
    sidebar.classList.add("collapsed")
    sidebar.classList.remove("overlay")
    sidebarMask.style.display = "none"
    isManualExpand = false
}

//页面大小变化
window.addEventListener("resize", () => {
    const w = window.innerWidth
    if (w < COLLAPSE_WIDTH) {
        if (!isManualExpand) {
            sidebar.classList.add("collapsed")
            sidebar.classList.remove("overlay")
            sidebarMask.style.display = "none"
        }
    } else {
        if (sidebarMask.style.display != "none"){
            sidebar.classList.remove("overlay")
            sidebarMask.style.display = "none"
            sidebar.classList.add("collapsed")
        }
        isManualExpand = false
    }
})

//历史记录对话滑条
chatHistoryList.addEventListener('mouseenter', function () {
    chatHistoryList.classList.add('show-scrollbar')
})

chatHistoryList.addEventListener('mouseleave', function () {
    chatHistoryList.classList.remove('show-scrollbar')
})