// Import and re-export everything from http-shim
import * as http from './http-shim';

export const request = http.request;
export const ClientRequest = http.ClientRequest;
export const IncomingMessage = http.IncomingMessage;

export default {
  request,
  ClientRequest,
  IncomingMessage
};