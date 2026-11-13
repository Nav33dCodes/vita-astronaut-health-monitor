using System.Net;
using System.Net.Http.Json;
using AstroHealth.Application.Astronauts;
using AstroHealth.Application.Hazards;
using AstroHealth.Application.Missions;
using AstroHealth.Application.Vitals;
using AstroHealth.Domain.Astronauts;
using AstroHealth.Domain.Hazards;
using AstroHealth.Domain.Missions;

namespace AstroHealth.Tests.Api;

public class HazardTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private async Task<(Guid MissionId, Guid AstronautId)> ActiveCrewMemberAsync(MissionDestination destination)
    {
        var mission = await (await _client.PostAsJsonAsync("/api/v1/missions",
                new CreateMissionRequest($"Hazard {Guid.NewGuid():N}", destination, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-10), null),
                ApiFactory.Json))
            .ReadAsAsync<MissionResponse>();

        var activated = await _client.PatchAsJsonAsync($"/api/v1/missions/{mission.Id}/status",
            new ChangeMissionStatusRequest(MissionStatus.Active), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.OK, activated.StatusCode);

        var astronaut = await (await _client.PostAsJsonAsync("/api/v1/astronauts",
                new UpsertAstronautRequest("Hazard", "Tester", "NASA", CrewRole.MissionSpecialist, new DateOnly(1988, 8, 8), mission.Id),
                ApiFactory.Json))
            .ReadAsAsync<AstronautDetailResponse>();

        return (mission.Id, astronaut.Id);
    }

    [Fact]
    public async Task Overview_assesses_every_crew_member_against_the_five_hazards()
    {
        var (missionId, astronautId) = await ActiveCrewMemberAsync(MissionDestination.Mars);

        await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronautId}/vitals",
            new RecordVitalsRequest(72, 118, 76, 98m, 36.8m, 14, 0.002m, RadiationDoseRateMsvPerDay: 1.8m), ApiFactory.Json);
        var cabin = await _client.PostAsJsonAsync($"/api/v1/missions/{missionId}/habitat",
            new RecordHabitatRequest(3.6m, 21m, 101.3m, 22m, 45m, 1.8m), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Created, cabin.StatusCode);

        var overview = await (await _client.GetAsync("/api/v1/hazards")).ReadAsAsync<HazardOverviewResponse>();

        var mission = Assert.Single(overview.Missions, m => m.MissionId == missionId);
        Assert.Equal(AutonomyLevel.EarthIndependent, mission.CommunicationDelay.Autonomy);
        Assert.Equal(HealthStatus.Caution, mission.Habitat!.Status); // CO2 above 3 mmHg

        var crew = Assert.Single(mission.Crew);
        Assert.Equal(Enum.GetValues<SpaceHazard>().Length, crew.Hazards.Count);
        Assert.Equal(HealthStatus.Caution, crew.Hazards.Single(h => h.Hazard == SpaceHazard.HostileClosedEnvironments).Status);

        // Ten days into a Mars mission the dose record is back-filled from the deep-space background rate.
        Assert.InRange(crew.Radiation.MissionDoseMsv, 15m, 25m);
        Assert.Equal(1.8m, crew.Radiation.CurrentRateMsvPerDay);
        Assert.NotNull(crew.Radiation.DaysToLimitAtCurrentRate);

        Assert.Equal(5, overview.Summary.Count);
    }

    [Fact]
    public async Task Check_in_is_validated_and_updates_behavioural_health()
    {
        var (_, astronautId) = await ActiveCrewMemberAsync(MissionDestination.Lunar);

        var invalid = await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronautId}/wellness/check-in",
            new WellnessCheckInRequest(6, 3, 3), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var response = await _client.PostAsJsonAsync($"/api/v1/astronauts/{astronautId}/wellness/check-in",
            new WellnessCheckInRequest(1, 5, 4, "Rough day"), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var wellness = await response.ReadAsAsync<WellnessResponse>();
        Assert.Equal(HealthStatus.Critical, wellness.Status);
        Assert.Equal(1, Assert.Single(wellness.Entries).Mood);
    }

    [Fact]
    public async Task Playbook_covers_radiation_events()
    {
        var playbook = await (await _client.GetAsync("/api/v1/hazards/playbook")).ReadAsAsync<List<PlaybookEntryResponse>>();

        var radiation = Assert.Single(playbook, p => p.Key == nameof(HabitatMetric.RadiationDoseRate));
        Assert.Equal(SpaceHazard.SpaceRadiation, radiation.Hazard);
        Assert.NotEmpty(radiation.Steps);
    }
}
