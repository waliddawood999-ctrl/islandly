using System;
using System.ComponentModel;
class PolicyTest {
    class HResultError : Exception { public HResultError(uint code) { HResult=unchecked((int)code); } }
    static void Assert(bool valid,string message) { if(!valid) throw new Exception(message); }
    static void Main() {
        uint[] blocked={577,1260,4551,0xc0e90002U,0xc0000428U,0xc0000361U,0xc0000362U,0xc0000363U,0xc0000364U,0xc0000603U,0xc0000605U,0x800704ecU,0x80070241U,0x800711c7U,0xd0000428U,0xd0e90002U};
        foreach(uint code in blocked) {
            var error=new Win32Exception(unchecked((int)code));
            Assert(LaunchPolicy.IsBlocked(error),"Missing policy error "+code);
            Assert(LaunchPolicy.IsBlocked(new Exception("wrapper",error)),"Wrapped policy error lost");
            Assert(LaunchPolicy.IsBlocked(new HResultError(code)),"HRESULT/NTSTATUS error lost");
            Assert(!LaunchPolicy.ShouldRetry(error,false) && !LaunchPolicy.ShouldRetry(error,true),"Policy block retried");
        }
        foreach(int code in new[]{0,2,5,32,87,193,216,unchecked((int)0xc0000005U),unchecked((int)0xd0000005U)}) {
            var error=new Win32Exception(code);
            Assert(!LaunchPolicy.IsBlocked(error),"Ordinary error mislabelled as SAC: "+code);
            Assert(LaunchPolicy.ShouldRetry(error,false) && !LaunchPolicy.ShouldRetry(error,true),"Ordinary bounded retry changed");
        }
        Assert(!LaunchPolicy.IsBlocked(null),"Null error");
        Assert(LaunchPolicy.Notice.Contains("\u0645\u0648\u0642\u0651\u0639") && LaunchPolicy.Notice.Contains("signed build") && LaunchPolicy.Notice.Length<=255,"Bilingual tray notice invalid");
        Console.WriteLine("Launch policy: Win32/NTSTATUS/HRESULT/wrapped blocks never retry; ordinary failures retain one retry; bilingual tray notice fits");
    }
}
