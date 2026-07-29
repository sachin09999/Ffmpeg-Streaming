import subprocess
import time
import os
import fcntl

proc = subprocess.Popen(
    ["python3", "-c", "import time, sys; sys.stderr.write('hello\\n'); sys.stderr.flush(); time.sleep(2); sys.stderr.write('world\\n'); sys.stderr.flush()"],
    stderr=subprocess.PIPE,
    stdout=subprocess.PIPE,
    bufsize=0 # unbuffered
)

fd = proc.stderr.fileno()
fl = fcntl.fcntl(fd, fcntl.F_GETFL)
fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

while True:
    try:
        chunk = os.read(fd, 1024)
        if not chunk:
            print("EOF")
            break
        print("Read:", chunk)
    except BlockingIOError:
        print("Blocked, sleeping...")
        time.sleep(0.5)

print("Done")
