import threading, queue, uuid, time, shlex, subprocess, sys, os, traceback

messages_queue = queue.Queue()
history = []
HISTORY_LIMIT = 2000
history_lock = threading.Lock()

VENV_PYTHON = sys.executable
VENV_PIP = os.path.join(os.path.dirname(VENV_PYTHON), "pip.exe" if os.name=="nt" else "pip")
if not os.path.exists(VENV_PIP):
    alt = os.path.join(os.path.dirname(VENV_PYTHON), "pip3")
    if os.path.exists(alt):
        VENV_PIP = alt

current_proc = {"proc": None, "lock": threading.Lock()}

def push_message_dao(kind, text):
    """推送消息到队列，并写入历史"""
    msg = {"id": str(uuid.uuid4()), "time": int(time.time()*1000), "kind": kind, "text": text}
    messages_queue.put(msg)
    with history_lock:
        history.append(msg)
        if len(history) > HISTORY_LIMIT:
            history[:] = history[-HISTORY_LIMIT:]

def run_command_background_dao(cmd_raw):
    """后台执行命令，输出消息到队列"""
    push_message_dao("cmd", f"$ {cmd_raw}\n")
    words = shlex.split(cmd_raw, posix=(os.name!="nt"))
    if len(words) > 0:
        w0 = words[0].lower()
        replaced = False
        if w0 in ("pip","pip3") and os.path.exists(VENV_PIP):
            words[0] = VENV_PIP; replaced=True
        elif w0 in ("python","python3"):
            words[0] = VENV_PYTHON; replaced=True
        if replaced: cmd_list = words; use_shell = False
        else: cmd_list = cmd_raw; use_shell = True
    else: cmd_list = cmd_raw; use_shell = True

    try:
        with current_proc["lock"]:
            proc = subprocess.Popen(
                cmd_list, shell=use_shell,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL, bufsize=1, universal_newlines=True,
                env=os.environ
            )
            current_proc["proc"] = proc

        push_message_dao("info", f"进程已启动，pid={proc.pid}\n")

        def reader_stream(stream, kind_label):
            try:
                for line in iter(stream.readline,""):
                    push_message_dao(kind_label,line if line.endswith("\n") else line+"\n")
            except Exception as e:
                push_message_dao("err", f"读取输出异常: {e}\n")
            finally:
                try: stream.close()
                except: pass

        threading.Thread(target=reader_stream,args=(proc.stdout,"out"),daemon=True).start()
        threading.Thread(target=reader_stream,args=(proc.stderr,"err"),daemon=True).start()

        exit_code = proc.wait()
        push_message_dao("exit", f"进程退出，code={exit_code}\n")
    finally:
        with current_proc["lock"]:
            current_proc["proc"] = None

def get_history_dao(limit=1000):
    """返回历史消息"""
    with history_lock:
        return history[-limit:]

def poll_messages_dao(since=0):
    """返回指定时间戳之后的消息"""
    with history_lock:
        return [m for m in history if m["time"] > since]
