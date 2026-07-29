import subprocess
import time
import sys

proc = subprocess.Popen(
    ["python3", "-c", "import time, sys; sys.stderr.write('hello'); sys.stderr.flush(); time.sleep(1); sys.stderr.write('world'); sys.stderr.flush()"],
    stderr=subprocess.PIPE,
    stdout=subprocess.PIPE
)

print("Reading 1...")
print(proc.stderr.read1(1024))
print("Reading 2...")
print(proc.stderr.read1(1024))
