"""
Pagination à liens relatifs : `next` / `previous` valent « /api/v1/…?page=2 » et non
« http://hôte:port/api/v1/… ». Le frontend passe par un proxy : une URL absolue pointerait
vers l'hôte interne du backend (et casserait CORS).

Peut servir de pagination par défaut :
    REST_FRAMEWORK["DEFAULT_PAGINATION_CLASS"] = "apps.core.pagination.RelativePageNumberPagination"
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.utils.urls import remove_query_param, replace_query_param


class RelativePageNumberPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 100

    def _current_url(self) -> str:
        return self.request.get_full_path()

    def get_next_link(self):
        if not self.page.has_next():
            return None
        return replace_query_param(self._current_url(), self.page_query_param, self.page.next_page_number())

    def get_previous_link(self):
        if not self.page.has_previous():
            return None
        url = self._current_url()
        page_number = self.page.previous_page_number()
        if page_number == 1:
            return remove_query_param(url, self.page_query_param)
        return replace_query_param(url, self.page_query_param, page_number)
