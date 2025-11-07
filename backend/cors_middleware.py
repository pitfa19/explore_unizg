from typing import Callable
from django.http import HttpRequest, HttpResponse


class SimpleCORS:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)

        origin = request.headers.get("Origin")
        if origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
        else:
            response.setdefault("Access-Control-Allow-Origin", "*")

        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, PUT, PATCH, DELETE"
        acrh = request.headers.get("Access-Control-Request-Headers")
        if acrh:
            response["Access-Control-Allow-Headers"] = acrh
        else:
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response["Access-Control-Max-Age"] = "86400"
        return response


