// LAN sharing is deferred until interface selection and network confirmation exist.
class LocalShare {
  async share() {
    throw new Error("LAN sharing is unavailable pending network selection UI");
  }
  stop() {}
}
module.exports = { LocalShare };
