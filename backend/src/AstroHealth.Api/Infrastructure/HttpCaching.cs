using System.Security.Cryptography;

namespace AstroHealth.Api.Infrastructure;

/// <summary>Marks an endpoint whose response browsers may reuse without asking, for <see cref="MaxAge"/>.</summary>
internal sealed record BrowserCacheMetadata(TimeSpan MaxAge);

internal static class HttpCachingExtensions
{
    /// <summary>For reference data that rarely changes: browsers serve it from cache for <paramref name="maxAge"/>.</summary>
    public static RouteHandlerBuilder WithBrowserCache(this RouteHandlerBuilder builder, TimeSpan maxAge) =>
        builder.WithMetadata(new BrowserCacheMetadata(maxAge));
}

/// <summary>
/// Conditional GET for the JSON API. Every successful GET gets a content-hash ETag; when the
/// browser revalidates with If-None-Match and nothing changed, it receives an empty 304 instead of
/// the full payload — a big saving on slow or jittery networks.
/// <list type="bullet">
/// <item>Endpoints marked <see cref="BrowserCacheMetadata"/>: <c>public, max-age=N</c> (no request at all while fresh).</item>
/// <item>Everything else: <c>private, no-cache</c> (always revalidate, so live data is never served stale).</item>
/// </list>
/// </summary>
internal sealed class ConditionalGetMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsGet(context.Request.Method) || !context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        var original = context.Response.Body;
        await using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next(context);
        }
        finally
        {
            context.Response.Body = original;
        }

        var response = context.Response;
        if (response.StatusCode == StatusCodes.Status200OK && buffer.Length > 0)
        {
            var hash = SHA256.HashData(buffer.GetBuffer().AsSpan(0, (int)buffer.Length));
            var etag = $"W/\"{Convert.ToBase64String(hash, 0, 16)}\"";

            var maxAge = context.GetEndpoint()?.Metadata.GetMetadata<BrowserCacheMetadata>()?.MaxAge;
            response.Headers.ETag = etag;
            response.Headers.CacheControl = maxAge is { } age
                ? $"public, max-age={(int)age.TotalSeconds}"
                : "private, no-cache";

            if (Matches(context.Request.Headers.IfNoneMatch, etag))
            {
                response.StatusCode = StatusCodes.Status304NotModified;
                response.ContentLength = null;
                return;
            }
        }

        buffer.Position = 0;
        await buffer.CopyToAsync(original, context.RequestAborted);
    }

    private static bool Matches(Microsoft.Extensions.Primitives.StringValues ifNoneMatch, string etag) =>
        ifNoneMatch.SelectMany(v => (v ?? string.Empty).Split(',', StringSplitOptions.TrimEntries))
            .Any(candidate => candidate == "*" || candidate == etag);
}
