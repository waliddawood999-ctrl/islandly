"""Moves and clicks the real X11 pointer and presses real keys (XTEST), so tests can drive the real Electron window like a user.
usage: xmouse.py move X Y | click [button] | scroll up|down | type TEXT | key NAME
"""
import sys
from Xlib import X, XK, display
from Xlib.ext import xtest

d = display.Display()


def press(kind_down, kind_up, detail):
    xtest.fake_input(d, kind_down, detail)
    d.sync()
    xtest.fake_input(d, kind_up, detail)
    d.sync()


cmd = sys.argv[1]
if cmd == 'move':
    xtest.fake_input(d, X.MotionNotify, x=int(sys.argv[2]), y=int(sys.argv[3]))
elif cmd == 'click':
    press(X.ButtonPress, X.ButtonRelease, int(sys.argv[2]) if len(sys.argv) > 2 else 1)
elif cmd == 'scroll':
    press(X.ButtonPress, X.ButtonRelease, 4 if sys.argv[2] == 'up' else 5)
elif cmd in ('type', 'key'):
    for ch in (list(sys.argv[2]) if cmd == 'type' else [sys.argv[2]]):
        name = {' ': 'space'}.get(ch, ch)
        press(X.KeyPress, X.KeyRelease, d.keysym_to_keycode(XK.string_to_keysym(name)))
d.sync()
