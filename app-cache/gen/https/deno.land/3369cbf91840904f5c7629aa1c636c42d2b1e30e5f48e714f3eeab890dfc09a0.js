import * as bcrypt from "./bcrypt/bcrypt.ts";
const context = self;
context.onmessage = (event)=>{
  let data = event.data;
  switch(data.action){
    case "hash":
      {
        context.postMessage(bcrypt.hashpw(data.payload.plaintext, data.payload.salt));
        break;
      }
    case "genSalt":
      {
        context.postMessage(bcrypt.gensalt(data.payload.log_rounds));
        break;
      }
    case "compare":
      {
        let result;
        try {
          result = bcrypt.checkpw(data.payload.plaintext, data.payload.hash);
        } catch  {
          result = false;
        }
        context.postMessage(result);
        break;
      }
    default:
      {
        throw Error("Invalid data sent to worker");
      }
  }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvYmNyeXB0QHYwLjQuMS9zcmMvd29ya2VyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGJjcnlwdCBmcm9tIFwiLi9iY3J5cHQvYmNyeXB0LnRzXCI7XG5cbmNvbnN0IGNvbnRleHQ6IFdvcmtlciA9IHNlbGYgYXMgYW55O1xuXG5jb250ZXh0Lm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICBsZXQgZGF0YSA9IGV2ZW50LmRhdGE7XG4gIHN3aXRjaCAoZGF0YS5hY3Rpb24pIHtcbiAgICBjYXNlIFwiaGFzaFwiOiB7XG4gICAgICBjb250ZXh0LnBvc3RNZXNzYWdlKFxuICAgICAgICBiY3J5cHQuaGFzaHB3KGRhdGEucGF5bG9hZC5wbGFpbnRleHQsIGRhdGEucGF5bG9hZC5zYWx0KSxcbiAgICAgICk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcImdlblNhbHRcIjoge1xuICAgICAgY29udGV4dC5wb3N0TWVzc2FnZShcbiAgICAgICAgYmNyeXB0LmdlbnNhbHQoZGF0YS5wYXlsb2FkLmxvZ19yb3VuZHMpLFxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwiY29tcGFyZVwiOiB7XG4gICAgICBsZXQgcmVzdWx0OiBib29sZWFuO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gYmNyeXB0LmNoZWNrcHcoZGF0YS5wYXlsb2FkLnBsYWludGV4dCwgZGF0YS5wYXlsb2FkLmhhc2gpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgY29udGV4dC5wb3N0TWVzc2FnZShcbiAgICAgICAgcmVzdWx0LFxuICAgICAgKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBkZWZhdWx0OiB7XG4gICAgICB0aHJvdyBFcnJvcihcIkludmFsaWQgZGF0YSBzZW50IHRvIHdvcmtlclwiKTtcbiAgICB9XG4gIH1cbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWSxZQUFZLHFCQUFxQjtBQUU3QyxNQUFNLFVBQWtCO0FBRXhCLFFBQVEsU0FBUyxHQUFHLENBQUM7RUFDbkIsSUFBSSxPQUFPLE1BQU0sSUFBSTtFQUNyQixPQUFRLEtBQUssTUFBTTtJQUNqQixLQUFLO01BQVE7UUFDWCxRQUFRLFdBQVcsQ0FDakIsT0FBTyxNQUFNLENBQUMsS0FBSyxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUssT0FBTyxDQUFDLElBQUk7UUFFekQ7TUFDRjtJQUNBLEtBQUs7TUFBVztRQUNkLFFBQVEsV0FBVyxDQUNqQixPQUFPLE9BQU8sQ0FBQyxLQUFLLE9BQU8sQ0FBQyxVQUFVO1FBRXhDO01BQ0Y7SUFDQSxLQUFLO01BQVc7UUFDZCxJQUFJO1FBQ0osSUFBSTtVQUNGLFNBQVMsT0FBTyxPQUFPLENBQUMsS0FBSyxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUssT0FBTyxDQUFDLElBQUk7UUFDbkUsRUFBRSxPQUFNO1VBQ04sU0FBUztRQUNYO1FBQ0EsUUFBUSxXQUFXLENBQ2pCO1FBRUY7TUFDRjtJQUNBO01BQVM7UUFDUCxNQUFNLE1BQU07TUFDZDtFQUNGO0FBQ0YifQ==