import { nanoid } from 'https://deno.land/x/nanoid@v3.0.0/async.ts';
import MemoryStore from './stores/MemoryStore.ts';
import CookieStore from './stores/CookieStore.ts';
export default class Session {
  sid;
  // user should interact with data using `get(), set(), flash(), has()`
  data;
  ctx;
  // construct a Session with no data and id
  // private: force user to create session in initMiddleware()
  constructor(sid, data, ctx){
    this.sid = sid;
    this.data = data;
    this.ctx = ctx;
  }
  static initMiddleware(store = new MemoryStore(), { expireAfterSeconds = null, cookieGetOptions = {}, cookieSetOptions = {}, sessionCookieName = 'session' } = {}) {
    const initMiddleware = async (ctx, next)=>{
      // get sessionId from cookie
      const sid = await ctx.cookies.get(sessionCookieName, cookieGetOptions);
      let session;
      if (sid) {
        // load session data from store
        const sessionData = store instanceof CookieStore ? await store.getSessionByCtx(ctx) : await store.getSessionById(sid);
        if (sessionData) {
          // load success, check if it's valid (not expired)
          if (this.sessionValid(sessionData)) {
            session = new Session(sid, sessionData, ctx);
            await session.reupSession(store, expireAfterSeconds);
          } else {
            // invalid session
            store instanceof CookieStore ? store.deleteSession(ctx) : await store.deleteSession(sid);
            session = await this.createSession(ctx, store, expireAfterSeconds);
          }
        } else {
          session = await this.createSession(ctx, store, expireAfterSeconds);
        }
      } else {
        session = await this.createSession(ctx, store, expireAfterSeconds);
      }
      // store session to ctx.state so user can interact (set, get) with it
      ctx.state.session = session;
      // update _access time
      session.set('_accessed', new Date().toISOString());
      await ctx.cookies.set(sessionCookieName, session.sid, cookieSetOptions);
      await next();
      if (ctx.state.rotate_session_key && !(store instanceof CookieStore)) {
        await store.deleteSession(session.sid);
        session = await this.createSession(ctx, store, expireAfterSeconds, session.data);
        await ctx.cookies.set(sessionCookieName, session.sid, cookieSetOptions);
      }
      // request done, push session data to store
      await session.persistSessionData(store);
      if (session.data._delete) {
        store instanceof CookieStore ? store.deleteSession(ctx) : await store.deleteSession(session.sid);
      }
    };
    return initMiddleware;
  }
  // should only be called in `initMiddleware()` when validating session data
  static sessionValid(sessionData) {
    return sessionData._expire == null || Date.now() < new Date(sessionData._expire).getTime();
  }
  // should only be called in `initMiddleware()`
  async reupSession(store, expiration) {
    // expiration in seconds
    this.data._expire = expiration ? new Date(Date.now() + expiration * 1000).toISOString() : null;
    await this.persistSessionData(store);
  }
  // should only be called in `initMiddleware()` when creating a new session
  static async createSession(ctx, store, expiration, defaultData) {
    const sessionData = defaultData ? defaultData : {
      '_flash': {},
      '_accessed': new Date().toISOString(),
      '_expire': expiration ? new Date(Date.now() + expiration * 1000).toISOString() : null,
      '_delete': false
    };
    const newID = await nanoid(21);
    store instanceof CookieStore ? await store.createSession(ctx, sessionData) : await store.createSession(newID, sessionData);
    return new Session(newID, sessionData, ctx);
  }
  // set _delete to true, will be deleted in middleware
  // should be called by user using `ctx.state.session.deleteSession()`
  // we might be able to remove async here, but that might be a breaking change?
  // deno-lint-ignore require-await
  async deleteSession() {
    this.data._delete = true;
  }
  // push current session data to Session.store
  // ctx is needed for CookieStore
  persistSessionData(store) {
    return store instanceof CookieStore ? store.persistSessionData(this.ctx, this.data) : store.persistSessionData(this.sid, this.data);
  }
  // Methods exposed for users to manipulate session data
  get(key) {
    if (key in this.data) {
      return this.data[key];
    } else {
      const value = this.data['_flash'][key];
      delete this.data['_flash'][key];
      return value;
    }
  }
  set(key, value) {
    if (value === null || value === undefined) {
      delete this.data[key];
    } else {
      this.data[key] = value;
    }
  }
  flash(key, value) {
    this.data['_flash'][key] = value;
  }
  has(key) {
    return key in this.data || key in this.data['_flash'];
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrX3Nlc3Npb25zQHY0LjEuOS9zcmMvU2Vzc2lvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBuYW5vaWQgfSBmcm9tICdodHRwczovL2Rlbm8ubGFuZC94L25hbm9pZEB2My4wLjAvYXN5bmMudHMnXG5pbXBvcnQgTWVtb3J5U3RvcmUgZnJvbSAnLi9zdG9yZXMvTWVtb3J5U3RvcmUudHMnXG5pbXBvcnQgQ29va2llU3RvcmUgZnJvbSAnLi9zdG9yZXMvQ29va2llU3RvcmUudHMnXG5pbXBvcnQgdHlwZSB7IENvbnRleHQsIE1pZGRsZXdhcmUgfSBmcm9tICcuLi9kZXBzLnRzJ1xuaW1wb3J0IHR5cGUgU3RvcmUgZnJvbSAnLi9zdG9yZXMvU3RvcmUudHMnXG5pbXBvcnQgdHlwZSB7IENvb2tpZXNHZXRPcHRpb25zLCBDb29raWVzU2V0RGVsZXRlT3B0aW9ucyB9IGZyb20gJy4uL2RlcHMudHMnXG5cblxuaW50ZXJmYWNlIFNlc3Npb25PcHRpb25zIHtcbiAgZXhwaXJlQWZ0ZXJTZWNvbmRzPzogbnVtYmVyIHwgbnVsbFxuICBjb29raWVHZXRPcHRpb25zPzogQ29va2llc0dldE9wdGlvbnNcbiAgY29va2llU2V0T3B0aW9ucz86IENvb2tpZXNTZXREZWxldGVPcHRpb25zXG4gIHNlc3Npb25Db29raWVOYW1lPzogc3RyaW5nXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2Vzc2lvbkRhdGEge1xuICBfZmxhc2g6IFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gIF9hY2Nlc3NlZDogc3RyaW5nIHwgbnVsbFxuICBfZXhwaXJlOiBzdHJpbmcgfCBudWxsXG4gIF9kZWxldGU6IGJvb2xlYW5cbiAgW2tleTogc3RyaW5nXTogdW5rbm93blxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTZXNzaW9uIHtcblxuICBzaWQ6IHN0cmluZ1xuICAvLyB1c2VyIHNob3VsZCBpbnRlcmFjdCB3aXRoIGRhdGEgdXNpbmcgYGdldCgpLCBzZXQoKSwgZmxhc2goKSwgaGFzKClgXG4gIHByaXZhdGUgZGF0YTogU2Vzc2lvbkRhdGFcbiAgcHJpdmF0ZSBjdHg6IENvbnRleHRcblxuICAvLyBjb25zdHJ1Y3QgYSBTZXNzaW9uIHdpdGggbm8gZGF0YSBhbmQgaWRcbiAgLy8gcHJpdmF0ZTogZm9yY2UgdXNlciB0byBjcmVhdGUgc2Vzc2lvbiBpbiBpbml0TWlkZGxld2FyZSgpXG4gIHByaXZhdGUgY29uc3RydWN0b3IgKHNpZCA6IHN0cmluZywgZGF0YSA6IFNlc3Npb25EYXRhLCBjdHggOiBDb250ZXh0KSB7XG5cbiAgICB0aGlzLnNpZCA9IHNpZFxuICAgIHRoaXMuZGF0YSA9IGRhdGFcbiAgICB0aGlzLmN0eCA9IGN0eFxuICB9XG5cbiAgc3RhdGljIGluaXRNaWRkbGV3YXJlKHN0b3JlOiBTdG9yZSB8IENvb2tpZVN0b3JlID0gbmV3IE1lbW9yeVN0b3JlKCksIHtcbiAgICBleHBpcmVBZnRlclNlY29uZHMgPSBudWxsLFxuICAgIGNvb2tpZUdldE9wdGlvbnMgPSB7fSxcbiAgICBjb29raWVTZXRPcHRpb25zID0ge30sXG4gICAgc2Vzc2lvbkNvb2tpZU5hbWUgPSAnc2Vzc2lvbidcbiAgfTogU2Vzc2lvbk9wdGlvbnMgPSB7fSkge1xuXG4gICAgY29uc3QgaW5pdE1pZGRsZXdhcmU6IE1pZGRsZXdhcmUgPSBhc3luYyAoY3R4LCBuZXh0KSA9PiB7XG4gICAgICAvLyBnZXQgc2Vzc2lvbklkIGZyb20gY29va2llXG4gICAgICBjb25zdCBzaWQgPSBhd2FpdCBjdHguY29va2llcy5nZXQoc2Vzc2lvbkNvb2tpZU5hbWUsIGNvb2tpZUdldE9wdGlvbnMpXG4gICAgICBsZXQgc2Vzc2lvbjogU2Vzc2lvbjtcblxuICAgICAgaWYgKHNpZCkge1xuICAgICAgICAvLyBsb2FkIHNlc3Npb24gZGF0YSBmcm9tIHN0b3JlXG4gICAgICAgIGNvbnN0IHNlc3Npb25EYXRhID0gc3RvcmUgaW5zdGFuY2VvZiBDb29raWVTdG9yZSA/IGF3YWl0IHN0b3JlLmdldFNlc3Npb25CeUN0eChjdHgpIDogYXdhaXQgc3RvcmUuZ2V0U2Vzc2lvbkJ5SWQoc2lkKVxuXG4gICAgICAgIGlmIChzZXNzaW9uRGF0YSkge1xuICAgICAgICAgIC8vIGxvYWQgc3VjY2VzcywgY2hlY2sgaWYgaXQncyB2YWxpZCAobm90IGV4cGlyZWQpXG4gICAgICAgICAgaWYgKHRoaXMuc2Vzc2lvblZhbGlkKHNlc3Npb25EYXRhKSkge1xuICAgICAgICAgICAgc2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNpZCwgc2Vzc2lvbkRhdGEsIGN0eCk7XG4gICAgICAgICAgICBhd2FpdCBzZXNzaW9uLnJldXBTZXNzaW9uKHN0b3JlLCBleHBpcmVBZnRlclNlY29uZHMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpbnZhbGlkIHNlc3Npb25cbiAgICAgICAgICAgIHN0b3JlIGluc3RhbmNlb2YgQ29va2llU3RvcmUgPyBzdG9yZS5kZWxldGVTZXNzaW9uKGN0eCkgOiBhd2FpdCBzdG9yZS5kZWxldGVTZXNzaW9uKHNpZClcbiAgICAgICAgICAgIHNlc3Npb24gPSBhd2FpdCB0aGlzLmNyZWF0ZVNlc3Npb24oY3R4LCBzdG9yZSwgZXhwaXJlQWZ0ZXJTZWNvbmRzKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZXNzaW9uID0gYXdhaXQgdGhpcy5jcmVhdGVTZXNzaW9uKGN0eCwgc3RvcmUsIGV4cGlyZUFmdGVyU2Vjb25kcylcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXNzaW9uID0gYXdhaXQgdGhpcy5jcmVhdGVTZXNzaW9uKGN0eCwgc3RvcmUsIGV4cGlyZUFmdGVyU2Vjb25kcylcbiAgICAgIH1cblxuICAgICAgLy8gc3RvcmUgc2Vzc2lvbiB0byBjdHguc3RhdGUgc28gdXNlciBjYW4gaW50ZXJhY3QgKHNldCwgZ2V0KSB3aXRoIGl0XG4gICAgICBjdHguc3RhdGUuc2Vzc2lvbiA9IHNlc3Npb247XG5cbiAgICAgIC8vIHVwZGF0ZSBfYWNjZXNzIHRpbWVcbiAgICAgIHNlc3Npb24uc2V0KCdfYWNjZXNzZWQnLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpXG4gICAgICBhd2FpdCBjdHguY29va2llcy5zZXQoc2Vzc2lvbkNvb2tpZU5hbWUsIHNlc3Npb24uc2lkLCBjb29raWVTZXRPcHRpb25zKVxuXG5cbiAgICAgIGF3YWl0IG5leHQoKVxuXG4gICAgICBpZiAoY3R4LnN0YXRlLnJvdGF0ZV9zZXNzaW9uX2tleSAmJiAhKHN0b3JlIGluc3RhbmNlb2YgQ29va2llU3RvcmUpKSB7XG4gICAgICAgIGF3YWl0IHN0b3JlLmRlbGV0ZVNlc3Npb24oc2Vzc2lvbi5zaWQpXG4gICAgICAgIHNlc3Npb24gPSBhd2FpdCB0aGlzLmNyZWF0ZVNlc3Npb24oY3R4LCBzdG9yZSwgZXhwaXJlQWZ0ZXJTZWNvbmRzLCBzZXNzaW9uLmRhdGEpXG4gICAgICAgIGF3YWl0IGN0eC5jb29raWVzLnNldChzZXNzaW9uQ29va2llTmFtZSwgc2Vzc2lvbi5zaWQsIGNvb2tpZVNldE9wdGlvbnMpXG4gICAgICB9XG5cbiAgICAgIC8vIHJlcXVlc3QgZG9uZSwgcHVzaCBzZXNzaW9uIGRhdGEgdG8gc3RvcmVcbiAgICAgIGF3YWl0IHNlc3Npb24ucGVyc2lzdFNlc3Npb25EYXRhKHN0b3JlKVxuXG4gICAgICBpZiAoc2Vzc2lvbi5kYXRhLl9kZWxldGUpIHtcbiAgICAgICAgc3RvcmUgaW5zdGFuY2VvZiBDb29raWVTdG9yZSA/IHN0b3JlLmRlbGV0ZVNlc3Npb24oY3R4KSA6IGF3YWl0IHN0b3JlLmRlbGV0ZVNlc3Npb24oc2Vzc2lvbi5zaWQpXG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBpbml0TWlkZGxld2FyZVxuICB9XG5cbiAgLy8gc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGluIGBpbml0TWlkZGxld2FyZSgpYCB3aGVuIHZhbGlkYXRpbmcgc2Vzc2lvbiBkYXRhXG4gIHByaXZhdGUgc3RhdGljIHNlc3Npb25WYWxpZChzZXNzaW9uRGF0YTogU2Vzc2lvbkRhdGEpIHtcbiAgICByZXR1cm4gc2Vzc2lvbkRhdGEuX2V4cGlyZSA9PSBudWxsIHx8IERhdGUubm93KCkgPCBuZXcgRGF0ZShzZXNzaW9uRGF0YS5fZXhwaXJlKS5nZXRUaW1lKCk7XG4gIH1cblxuICAvLyBzaG91bGQgb25seSBiZSBjYWxsZWQgaW4gYGluaXRNaWRkbGV3YXJlKClgXG4gIHByaXZhdGUgYXN5bmMgcmV1cFNlc3Npb24oc3RvcmUgOiBTdG9yZSB8IENvb2tpZVN0b3JlLCBleHBpcmF0aW9uIDogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICAgIC8vIGV4cGlyYXRpb24gaW4gc2Vjb25kc1xuICAgIHRoaXMuZGF0YS5fZXhwaXJlID0gZXhwaXJhdGlvbiA/IG5ldyBEYXRlKERhdGUubm93KCkgKyBleHBpcmF0aW9uICogMTAwMCkudG9JU09TdHJpbmcoKSA6IG51bGxcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3RTZXNzaW9uRGF0YShzdG9yZSlcbiAgfVxuXG4gIC8vIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBpbiBgaW5pdE1pZGRsZXdhcmUoKWAgd2hlbiBjcmVhdGluZyBhIG5ldyBzZXNzaW9uXG4gIHByaXZhdGUgc3RhdGljIGFzeW5jIGNyZWF0ZVNlc3Npb24oXG4gICAgY3R4IDogQ29udGV4dCwgXG4gICAgc3RvcmUgOiBTdG9yZSB8IENvb2tpZVN0b3JlLCBcbiAgICBleHBpcmF0aW9uIDogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCwgXG4gICAgZGVmYXVsdERhdGE/OiBTZXNzaW9uRGF0YVxuICApIDogUHJvbWlzZTxTZXNzaW9uPiB7XG4gICAgY29uc3Qgc2Vzc2lvbkRhdGEgPSBkZWZhdWx0RGF0YSA/IGRlZmF1bHREYXRhIDoge1xuICAgICAgJ19mbGFzaCc6IHt9LFxuICAgICAgJ19hY2Nlc3NlZCc6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICdfZXhwaXJlJzogZXhwaXJhdGlvbiA/IG5ldyBEYXRlKERhdGUubm93KCkgKyBleHBpcmF0aW9uICogMTAwMCkudG9JU09TdHJpbmcoKSA6IG51bGwsXG4gICAgICAnX2RlbGV0ZSc6IGZhbHNlXG4gICAgfVxuXG4gICAgY29uc3QgbmV3SUQgPSBhd2FpdCBuYW5vaWQoMjEpXG4gICAgc3RvcmUgaW5zdGFuY2VvZiBDb29raWVTdG9yZSA/IGF3YWl0IHN0b3JlLmNyZWF0ZVNlc3Npb24oY3R4LCBzZXNzaW9uRGF0YSkgOiBhd2FpdCBzdG9yZS5jcmVhdGVTZXNzaW9uKG5ld0lELCBzZXNzaW9uRGF0YSlcblxuICAgIHJldHVybiBuZXcgU2Vzc2lvbihuZXdJRCwgc2Vzc2lvbkRhdGEsIGN0eClcbiAgfVxuXG4gIC8vIHNldCBfZGVsZXRlIHRvIHRydWUsIHdpbGwgYmUgZGVsZXRlZCBpbiBtaWRkbGV3YXJlXG4gIC8vIHNob3VsZCBiZSBjYWxsZWQgYnkgdXNlciB1c2luZyBgY3R4LnN0YXRlLnNlc3Npb24uZGVsZXRlU2Vzc2lvbigpYFxuICAvLyB3ZSBtaWdodCBiZSBhYmxlIHRvIHJlbW92ZSBhc3luYyBoZXJlLCBidXQgdGhhdCBtaWdodCBiZSBhIGJyZWFraW5nIGNoYW5nZT9cbiAgLy8gZGVuby1saW50LWlnbm9yZSByZXF1aXJlLWF3YWl0XG4gIGFzeW5jIGRlbGV0ZVNlc3Npb24oKSA6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZGF0YS5fZGVsZXRlID0gdHJ1ZVxuICB9XG5cbiAgLy8gcHVzaCBjdXJyZW50IHNlc3Npb24gZGF0YSB0byBTZXNzaW9uLnN0b3JlXG4gIC8vIGN0eCBpcyBuZWVkZWQgZm9yIENvb2tpZVN0b3JlXG4gIHByaXZhdGUgcGVyc2lzdFNlc3Npb25EYXRhKHN0b3JlIDogU3RvcmUgfCBDb29raWVTdG9yZSk6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcbiAgICByZXR1cm4gc3RvcmUgaW5zdGFuY2VvZiBDb29raWVTdG9yZSA/IHN0b3JlLnBlcnNpc3RTZXNzaW9uRGF0YSh0aGlzLmN0eCwgdGhpcy5kYXRhKSA6IHN0b3JlLnBlcnNpc3RTZXNzaW9uRGF0YSh0aGlzLnNpZCwgdGhpcy5kYXRhKVxuICB9XG5cbiAgLy8gTWV0aG9kcyBleHBvc2VkIGZvciB1c2VycyB0byBtYW5pcHVsYXRlIHNlc3Npb24gZGF0YVxuXG4gIGdldChrZXkgOiBzdHJpbmcpIHtcbiAgICBpZiAoa2V5IGluIHRoaXMuZGF0YSkge1xuICAgICAgcmV0dXJuIHRoaXMuZGF0YVtrZXldXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5kYXRhWydfZmxhc2gnXVtrZXldXG4gICAgICBkZWxldGUgdGhpcy5kYXRhWydfZmxhc2gnXVtrZXldXG4gICAgICByZXR1cm4gdmFsdWVcbiAgICB9XG4gIH1cblxuICBzZXQoa2V5IDogc3RyaW5nLCB2YWx1ZSA6IHVua25vd24pIHtcbiAgICBpZih2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBkZWxldGUgdGhpcy5kYXRhW2tleV1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kYXRhW2tleV0gPSB2YWx1ZVxuICAgIH1cbiAgfVxuXG4gIGZsYXNoKGtleSA6IHN0cmluZywgdmFsdWUgOiB1bmtub3duKSB7XG4gICAgdGhpcy5kYXRhWydfZmxhc2gnXVtrZXldID0gdmFsdWVcbiAgfVxuXG4gIGhhcyhrZXkgOiBzdHJpbmcpIHtcbiAgICByZXR1cm4ga2V5IGluIHRoaXMuZGF0YSB8fCBrZXkgaW4gdGhpcy5kYXRhWydfZmxhc2gnXTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLDZDQUE0QztBQUNuRSxPQUFPLGlCQUFpQiwwQkFBeUI7QUFDakQsT0FBTyxpQkFBaUIsMEJBQXlCO0FBcUJqRCxlQUFlLE1BQU07RUFFbkIsSUFBVztFQUNYLHNFQUFzRTtFQUM5RCxLQUFpQjtFQUNqQixJQUFZO0VBRXBCLDBDQUEwQztFQUMxQyw0REFBNEQ7RUFDNUQsWUFBcUIs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