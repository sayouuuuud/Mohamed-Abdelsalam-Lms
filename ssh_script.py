import paramiko
import sys

host = "169.58.19.247"
user = "temp_1787770294"
password = "N3B3ExropZV6JQxkcmlFH4spzR0/LM4F"
cmd = "docker ps -a"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(hostname=host, username=user, password=password)
    stdin, stdout, stderr = client.exec_command(cmd)
    print("STDOUT:")
    print(stdout.read().decode())
    print("STDERR:")
    print(stderr.read().decode())
finally:
    client.close()
