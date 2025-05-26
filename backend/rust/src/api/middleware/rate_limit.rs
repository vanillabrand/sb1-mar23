use actix_web::{
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse,
};
use futures::future::Ready;
use governor::{
    clock::DefaultClock,
    middleware::NoOpMiddleware,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use std::future::{ready, Future};
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Arc;

pub type AppRateLimiter = Arc<RateLimiter<NotKeyed, InMemoryState, DefaultClock, NoOpMiddleware>>;

pub fn create_rate_limiter() -> AppRateLimiter {
    // Allow 100 requests per minute per IP
    let quota = Quota::per_minute(std::num::NonZeroU32::new(100).unwrap());
    Arc::new(RateLimiter::direct(quota))
}

pub struct RateLimitMiddleware<S> {
    service: Rc<S>,
    limiter: AppRateLimiter,
}

impl<S, B> Service<ServiceRequest> for RateLimitMiddleware<S>
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
        let limiter = self.limiter.clone();

        Box::pin(async move {
            // Skip rate limiting for health checks
            if req.path() == "/health" || req.path() == "/metrics" {
                return service.call(req).await;
            }

            // Check rate limit
            match limiter.check() {
                Ok(_) => service.call(req).await,
                Err(_) => {
                    let response = HttpResponse::TooManyRequests()
                        .json(serde_json::json!({
                            "error": "RATE_LIMIT_EXCEEDED",
                            "message": "Too many requests. Please try again later.",
                            "status_code": 429
                        }));
                    Ok(req.into_response(response.map_into_boxed_body().map_into_right_body()))
                }
            }
        })
    }
}

pub struct RateLimitMiddlewareFactory {
    limiter: AppRateLimiter,
}

impl RateLimitMiddlewareFactory {
    pub fn new(limiter: AppRateLimiter) -> Self {
        Self { limiter }
    }
}

impl<S, B> Transform<S, ServiceRequest> for RateLimitMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RateLimitMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RateLimitMiddleware {
            service: Rc::new(service),
            limiter: self.limiter.clone(),
        }))
    }
}
