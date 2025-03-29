import axios from 'axios';

export class ClientRequest {
  constructor() {}
  
  end() {}
  
  on() {
    return this;
  }
  
  write() {
    return true;
  }
}

export class IncomingMessage {
  headers: Record<string, string> = {};
  statusCode: number = 200;
  
  on(event: string, callback: Function) {
    return this;
  }
}

export function request(url: string | any, options?: any, callback?: Function) {
  const req = new ClientRequest();
  return req;
}

export default {
  request,
  ClientRequest,
  IncomingMessage
};