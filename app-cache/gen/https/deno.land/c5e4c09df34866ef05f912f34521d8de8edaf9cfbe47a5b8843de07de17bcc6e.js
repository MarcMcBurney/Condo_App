export default class MongoStore {
  db;
  sessions;
  constructor(db, collectionName = 'sessions'){
    this.db = db;
    this.sessions = db.collection(collectionName);
  }
  async sessionExists(sessionId) {
    const session = await this.sessions.findOne({
      id: sessionId
    });
    return session ? true : false;
  }
  async getSessionById(sessionId) {
    const session = await this.sessions.findOne({
      id: sessionId
    });
    return session ? session.data : null;
  }
  async createSession(sessionId, initialData) {
    await this.sessions.replaceOne({
      id: sessionId
    }, {
      id: sessionId,
      data: initialData
    }, {
      upsert: true
    });
  }
  async deleteSession(sessionId) {
    await this.sessions.deleteOne({
      id: sessionId
    });
  }
  async persistSessionData(sessionId, sessionData) {
    await this.sessions.replaceOne({
      id: sessionId
    }, {
      id: sessionId,
      data: sessionData
    }, {
      upsert: true
    });
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrX3Nlc3Npb25zQHY0LjEuOS9zcmMvc3RvcmVzL01vbmdvU3RvcmUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFN0b3JlIGZyb20gJy4vU3RvcmUudHMnXG5pbXBvcnQgdHlwZSB7IERhdGFiYXNlLCBDb2xsZWN0aW9uIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvbW9uZ29AdjAuMzEuMi9tb2QudHNcIjtcbmltcG9ydCB0eXBlIHsgU2Vzc2lvbkRhdGEgfSBmcm9tICcuLi9TZXNzaW9uLnRzJ1xuXG5pbnRlcmZhY2UgTW9uZ29TZXNzaW9uIHtcbiAgaWQ6IHN0cmluZztcbiAgZGF0YTogU2Vzc2lvbkRhdGE7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1vbmdvU3RvcmUgaW1wbGVtZW50cyBTdG9yZSB7XG4gIGRiOiBEYXRhYmFzZVxuICBzZXNzaW9uczogQ29sbGVjdGlvbjxNb25nb1Nlc3Npb24+XG5cbiAgY29uc3RydWN0b3IoZGIgOiBEYXRhYmFzZSwgY29sbGVjdGlvbk5hbWUgPSAnc2Vzc2lvbnMnKSB7XG4gICAgdGhpcy5kYiA9IGRiXG4gICAgdGhpcy5zZXNzaW9ucyA9IGRiLmNvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpXG4gIH1cblxuICBhc3luYyBzZXNzaW9uRXhpc3RzKHNlc3Npb25JZCA6IHN0cmluZykge1xuICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLnNlc3Npb25zLmZpbmRPbmUoeyBpZDogc2Vzc2lvbklkIH0pXG5cbiAgICByZXR1cm4gc2Vzc2lvbiA/IHRydWUgOiBmYWxzZVxuICB9XG5cbiAgYXN5bmMgZ2V0U2Vzc2lvbkJ5SWQoc2Vzc2lvbklkIDogc3RyaW5nKSB7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuc2Vzc2lvbnMuZmluZE9uZSh7IGlkOiBzZXNzaW9uSWQgfSlcblxuICAgIHJldHVybiBzZXNzaW9uID8gc2Vzc2lvbi5kYXRhIDogbnVsbFxuICB9XG5cbiAgYXN5bmMgY3JlYXRlU2Vzc2lvbihzZXNzaW9uSWQgOiBzdHJpbmcsIGluaXRpYWxEYXRhIDogU2Vzc2lvbkRhdGEpIHtcbiAgICBhd2FpdCB0aGlzLnNlc3Npb25zLnJlcGxhY2VPbmUoXG4gICAgICB7IGlkOiBzZXNzaW9uSWQgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IHNlc3Npb25JZCxcbiAgICAgICAgZGF0YTogaW5pdGlhbERhdGFcbiAgICAgIH0sXG4gICAgICB7IHVwc2VydDogdHJ1ZSB9XG4gICAgKVxuICB9XG5cbiAgYXN5bmMgZGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQgOiBzdHJpbmcpIHtcbiAgICBhd2FpdCB0aGlzLnNlc3Npb25zLmRlbGV0ZU9uZSh7IGlkOiBzZXNzaW9uSWQgfSlcbiAgfVxuXG4gIGFzeW5jIHBlcnNpc3RTZXNzaW9uRGF0YShzZXNzaW9uSWQgOiBzdHJpbmcsIHNlc3Npb25EYXRhIDogU2Vzc2lvbkRhdGEpIHtcbiAgICBhd2FpdCB0aGlzLnNlc3Npb25zLnJlcGxhY2VPbmUoXG4gICAgICB7IGlkOiBzZXNzaW9uSWQgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6IHNlc3Npb25JZCxcbiAgICAgICAgZGF0YTogc2Vzc2lvbkRhdGFcbiAgICAgIH0sXG4gICAgICB7IHVwc2VydDogdHJ1ZSB9XG4gICAgKVxuICB9XG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQVNBLGVBQWUsTUFBTTtFQUNuQixHQUFZO0VBQ1osU0FBa0M7RUFFbEMsWUFBWSxFQUFhLEVBQUUsaUJBQWlCLFVBQVUsQ0FBRTtJQUN0RCxJQUFJLENBQUMsRUFBRSxHQUFHO0lBQ1YsSUFBSSxDQUFDLFFBQVEsR0FBRyxHQUFHLFVBQVUsQ0FBQztFQUNoQztFQUVBLE1BQU0sY0FBYyxTQUFrQixFQUFFO0lBQ3RDLE1BQU0sVUFBVSxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO01BQUUsSUFBSTtJQUFVO0lBRTVELE9BQU8sVUFBVSxPQUFPO0VBQzFCO0VBRUEsTUFBTSxlQUFlLFNBQWtCLEVBQUU7SUFDdkMsTUFBTSxVQUFVLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7TUFBRSxJQUFJO0lBQVU7SUFFNUQsT0FBTyxVQUFVLFFBQVEsSUFBSSxHQUFHO0VBQ2xDO0VBRUEsTUFBTSxjQUFjLFNBQWtCLEVBQUUsV0FBeUIsRUFBRTtJQUNqRSxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUM1QjtNQUFFLElBQUk7SUFBVSxHQUNoQjtNQUNFLElBQUk7TUFDSixNQUFNO0lBQ1IsR0FDQTtNQUFFLFFBQVE7SUFBSztFQUVuQjtFQUVBLE1BQU0sY0FBYyxTQUFrQixFQUFFO0lBQ3RDLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7TUFBRSxJQUFJO0lBQVU7RUFDaEQ7RUFFQSxNQUFNLG1CQUFtQixTQUFrQixFQUFFLFdBQXlCLEVBQUU7SUFDdEUsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FDNUI7TUFBRSxJQUFJO0lBQVUsR0FDaEI7TUFDRSxJQUFJO01BQ0osTUFBTTtJQUNSLEdBQ0E7TUFBRSxRQUFRO0lBQUs7RUFFbkI7QUFDRiJ9