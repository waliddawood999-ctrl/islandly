using System;
using System.ComponentModel;

// Policy errors identify application control/code integrity, not uniquely SAC versus WDAC.
public static class LaunchPolicy {
    public const string Notice = "حظر Windows Smart App Control / App Control لوحات Islandly. يلزم إصدار موقّع.\nWindows Smart App Control / App Control blocked Islandly's panels. The app needs a signed build.";
    static bool BlockedCode(uint code) {
        if((code & 0xffff0000U)==0x80070000U) code &= 0xffffU; // HRESULT_FROM_WIN32
        switch(code) {
            case 577: // ERROR_INVALID_IMAGE_HASH
            case 1260: // ERROR_ACCESS_DISABLED_BY_POLICY
            case 4551: // ERROR_SYSTEM_INTEGRITY_POLICY_VIOLATION
            case 0xc0000428U: // STATUS_INVALID_IMAGE_HASH
            case 0xc0000361U: // STATUS_ACCESS_DISABLED_BY_POLICY_DEFAULT
            case 0xc0000362U: // STATUS_ACCESS_DISABLED_BY_POLICY_PATH
            case 0xc0000363U: // STATUS_ACCESS_DISABLED_BY_POLICY_PUBLISHER
            case 0xc0000364U: // STATUS_ACCESS_DISABLED_BY_POLICY_OTHER
            case 0xc0000603U: // STATUS_IMAGE_CERT_REVOKED
            case 0xc0000605U: // STATUS_IMAGE_CERT_EXPIRED
                return true;
            default: return false;
        }
    }
    public static bool IsBlocked(Exception error) {
        for(var current=error;current!=null;current=current.InnerException) {
            var native=current as Win32Exception;
            if(native!=null && BlockedCode(unchecked((uint)native.NativeErrorCode))) return true;
            if(BlockedCode(unchecked((uint)current.HResult))) return true;
        }
        return false;
    }
    public static bool ShouldRetry(Exception error,bool alreadyRetried) { return !alreadyRetried && !IsBlocked(error); }
}
