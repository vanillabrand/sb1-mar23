use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};
use futures::future::Ready;
use std::future::{ready, Future};
use std::pin::Pin;
use std::rc::Rc;
use std::time::Instant;
use tracing::{info, warn, error};

pub struct LoggingMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for LoggingMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let start_time = Instant::now();
        let method = req.method().to_string();
        let path = req.path().to_string();
        let query = req.query_string().to_string();
        let user_agent = req
            .headers()
            .get("user-agent")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("unknown")
            .to_string();
        let remote_addr = req
            .connection_info()
            .peer_addr()
            .unwrap_or("unknown")
            .to_string();

        Box::pin(async move {
            let result = service.call(req).await;
            let duration = start_time.elapsed();

            match &result {
                Ok(response) => {
                    let status = response.status();
                    let status_code = status.as_u16();

                    if status.is_success() {
                        info!(
                            method = %method,
                            path = %path,
                            query = %query,
                            status = %status_code,
                            duration_ms = %duration.as_millis(),
                            remote_addr = %remote_addr,
                            user_agent = %user_agent,
                            "Request completed successfully"
                        );
                    } else if status.is_client_error() {
                        warn!(
                            method = %method,
                            path = %path,
                            query = %query,
                            status = %status_code,
                            duration_ms = %duration.as_millis(),
                            remote_addr = %remote_addr,
                            user_agent = %user_agent,
                            "Client error"
                        );
                    } else if status.is_server_error() {
                        error!(
                            method = %method,
                            path = %path,
                            query = %query,
                            status = %status_code,
                            duration_ms = %duration.as_millis(),
                            remote_addr = %remote_addr,
                            user_agent = %user_agent,
                            "Server error"
                        );
                    }
                }
                Err(err) => {
                    error!(
                        method = %method,
                        path = %path,
                        query = %query,
                        duration_ms = %duration.as_millis(),
                        remote_addr = %remote_addr,
                        user_agent = %user_agent,
                        error = %err,
                        "Request failed with error"
                    );
                }
            }

            result
        })
    }
}

pub struct LoggingMiddlewareFactory;

impl<S, B> Transform<S, ServiceRequest> for LoggingMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = LoggingMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(LoggingMiddleware {
            service: Rc::new(service),
        }))
    }
}
