import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "./route-statistics.service";
import { RouteData } from "../models/models";

describe("RouteStatisticsService", () => {
    let service: RouteStatisticsService;

    beforeEach(() => {
        service = new RouteStatisticsService();
    });

    it("Should get empty statistics on empty route", () => {
        let routeData = {
            segments: []
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBe(0);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).toBe(0);
        expect(statistics.points.length).toBe(0);
    });

    it("Should get statistics on route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 10, lng: 10, alt: 10 }, { lat: 20, lng: 20, alt: 20 }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 30, lng: 30, alt: 30 }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 10, lng: 10, alt: 10 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(20);
        expect(statistics.loss).toBeCloseTo(-20);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(5);
    });

    it("Should get statistics on route when first point alt is NaN", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 10, lng: 10, alt: NaN }, { lat: 20, lng: 20, alt: NaN }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 30, lng: 30, alt: 30 }]
                },
                {
                    latlngs: [{ lat: 30, lng: 30, alt: 30 }, { lat: 10, lng: 10, alt: 10 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(10);
        expect(statistics.loss).toBeCloseTo(-20);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(3);
    });

    it("Should get correct statistics on route when there are null altitudes", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 10, lng: 10, alt: 10 }, { lat: 20, lng: 20, alt: 20 }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 30, lng: 30, alt: null }]
                },
                {
                    latlngs: [{ lat: 30, lng: 30, alt: null }, { lat: 40, lng: 40, alt: 40 }]
                },
                {
                    latlngs: [{ lat: 40, lng: 40, alt: 40 }, { lat: 10, lng: 10, alt: 10 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(30);
        expect(statistics.loss).toBeCloseTo(-30);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(4);
    });

    it("Should get statistics on route when recording and there's a route close by", () => {
        let now = new Date();
        let lastLatLng = { lat: 2, lng: 2, alt: 20, timestamp: new Date(now.getTime() + 1000) };
        let recordingRouteData = {
            segments: [
                {
                    latlngs: [
                        { lat: 1, lng: 1, alt: 10, timestamp: now },
                        lastLatLng
                    ]
                }
            ]
        } as RouteData;
        let closestRouteData = {
            segments: [
                {
                    latlngs: [
                        { lat: 1, lng: 1, alt: 10 },
                        { lat: 2, lng: 2, alt: 20 },
                        { lat: 3, lng: 3, alt: 30 }
                    ]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(recordingRouteData, closestRouteData, lastLatLng, null, true);
        let statisticsOfCloseRoute = service.getStatistics(closestRouteData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(19.99,2);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).not.toBe(statisticsOfCloseRoute.length);
        expect(statistics.points.length).toBe(3);
        expect(statistics.averageSpeed).toBe(statistics.length * 3.6);
        expect(statistics.remainingDistance).toBe(statisticsOfCloseRoute.length - statistics.length);
    });

    it("Should get statistics on route when gps is close by", () => {
        let now = new Date();
        let gpsLatLng = { lat: 2, lng: 2, alt: 20, timestamp: new Date() };
        let routeData = {
            segments: [
                {
                    latlngs: [
                        { lat: 1, lng: 1, alt: 10 },
                        { lat: 2, lng: 2, alt: 20 },
                        { lat: 3, lng: 3, alt: 30 }
                    ]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, routeData, gpsLatLng, null, false);
        let statisticsOfFullRoute = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(3);
        expect(statistics.averageSpeed).toBeNull();
        expect(statistics.remainingDistance).toBeCloseTo(statistics.length, -2);
        expect(statistics.remainingDistance).toBeCloseTo(statisticsOfFullRoute.length / 2, -2);
    });

    it("Should get simplified statistics on route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 1, lng: 1, alt: 1 }, { lat: 4, lng: 4, alt: 4 }]
                },
                {
                    latlngs: [{ lat: 4, lng: 4, alt: 4 }, { lat: 1, lng: 1, alt: 1 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(3);
        expect(statistics.loss).toBeCloseTo(-3);
        expect(statistics.length).not.toBe(0);
    });

    it("Should get simplified statistics on route with outliers", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [
                        { lat: 31.3401, lng: 35.1014, alt: 10 },
                        { lat: 31.3403, lng: 35.1014, alt: 30 },
                        { lat: 31.340305, lng: 35.1014, alt: 700 },
                        { lat: 31.3404, lng: 35.1014, alt: 50 },
                        { lat: 31.3407, lng: 35.1014, alt: 70 },
                        { lat: 31.3408, lng: 35.1014, alt: 60 },
                        { lat: 31.3410, lng: 35.1014, alt: 40 },
                        { lat: 31.341005, lng: 35.1014, alt: -700 },
                        { lat: 31.3411, lng: 35.1014, alt: 30 },
                        { lat: 31.3413, lng: 35.1014, alt: 10 }
                    ]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null, null, null, false);

        expect(statistics.gain).toBeCloseTo(59.9,1);
        expect(statistics.loss).toBeCloseTo(-59.8,1);
        expect(statistics.length).not.toBe(0);
    });

    it("Should get statistics on part of route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 0, lng: 0, alt: 0 }, { lat: 0, lng: 0.01, alt: 2 }, { lat: 0, lng: 0.02, alt: 1 }]
                }
            ]
        } as RouteData;
        let statistics = service.getStatistics(routeData, null, null, null, false);
        let start = service.interpolateStatistics(statistics, 0.5);
        let end = service.interpolateStatistics(statistics, 1);
        statistics = service.getStatisticsByRange(routeData, start, end);

        expect(statistics.gain).toBeCloseTo(0.8, 1);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(2);
    });

    it("Should not interpolate statistics with less than 2 points", () => {
        let interpolated = service.interpolateStatistics({ points: [] } as IRouteStatistics, null);

        expect(interpolated).toBeNull();
    });

    it("Should interpolate statistics", () => {
        let interpolated = service.interpolateStatistics({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [1, 1],
                    latlng: { lat: 1, lng: 1 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [2, 2],
                    latlng: { lat: 2, lng: 2 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [3, 3],
                    latlng: { lat: 3, lng: 3 }
                } as IRouteStatisticsPoint
            ]
        } as IRouteStatistics, 2.5);

        expect(interpolated.coordinate[1]).toBe(2.5);
        expect(interpolated.latlng.lat).toBe(2.5);
        expect(interpolated.latlng.lng).toBe(2.5);
    });

    it("Should return 0 for statistics with less than 2 points", () => {
        let distance = service.findDistanceForLatLngInKM({ points: [] } as IRouteStatistics, null, null);

        expect(distance).toBe(0);
    });

    it("Should not return 0 distance for statistics on route", () => {
        let distance = service.findDistanceForLatLngInKM({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 1, lng: 1 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 2, lng: 2 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 3, lng: 3 }
                }
            ]
        } as IRouteStatistics, { lat: 0.6, lng: 0.6 }, null);

        expect(distance).not.toBe(0);
    });

    it("Should return 0 distance for statistics not on route", () => {
        let distance = service.findDistanceForLatLngInKM({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 0.0001, lng: 0.0001 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 0.0002, lng: 0.0002 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 0.0003, lng: 0.0003 }
                }
            ]
        } as IRouteStatistics, { lat: 0.005, lng: 0.005 }, null);

        expect(distance).toBe(0);
    });

    it("Should not return 0 distance for good location and statistics", () => {
        let distance = service.findDistanceForLatLngInKM({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 0.0001, lng: 0.0001 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 0.0002, lng: 0.0002 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 0.0003, lng: 0.0003 }
                }
            ]
        } as IRouteStatistics, { lat: 0.00015, lng: 0.00015 }, null);

        expect(distance).not.toBe(0);
    });

    it("Should return 0 distance for wrong direction", () => {
        let distance = service.findDistanceForLatLngInKM({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 0, lng: 0.0001 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 0, lng: 0.0002 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 0, lng: 0.0003 }
                }
            ]
        } as IRouteStatistics, { lat: 0, lng: 0.00015 }, 0);

        expect(distance).toBe(0);
    });
});
