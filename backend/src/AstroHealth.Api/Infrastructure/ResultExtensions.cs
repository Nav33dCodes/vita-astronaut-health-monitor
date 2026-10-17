using AstroHealth.Domain.Common;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AstroHealth.Api.Infrastructure;

internal static class ResultExtensions
{
    /// <summary>Maps a domain error to an RFC 9457 problem details response.</summary>
    public static ProblemHttpResult ToProblem(this Error error)
    {
        var (status, title) = error.Type switch
        {
            ErrorType.NotFound => (StatusCodes.Status404NotFound, "Resource not found"),
            ErrorType.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
            ErrorType.Validation => (StatusCodes.Status400BadRequest, "Validation failed"),
            _ => (StatusCodes.Status400BadRequest, "Request failed")
        };

        return TypedResults.Problem(
            statusCode: status,
            title: title,
            detail: error.Description,
            extensions: new Dictionary<string, object?> { ["code"] = error.Code });
    }
}
