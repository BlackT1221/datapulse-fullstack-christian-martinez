import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import * as L from 'leaflet';

import { NIVELES_RIESGO, NivelRiesgo, PaisMapa } from '../../../core/models';
import { crearPopupPais } from './popup-pais';

interface PropiedadesPais {
  iso_a2: string;
  iso_a3: string;
  nombre: string;
  monitoreado: boolean;
}

type GeoLatam = FeatureCollection<Geometry, PropiedadesPais>;

const URL_GEOJSON = 'assets/geojson/latam-countries.geojson';
const COLOR_NO_MONITOREADO = '#e2e3e8';
const COLOR_BORDE = '#ffffff';
const COLOR_RESALTE = '#1b1b1f';

@Component({
  selector: 'app-mapa-riesgo',
  imports: [MatCardModule],
  templateUrl: './mapa-riesgo.component.html',
  styleUrl: './mapa-riesgo.component.scss',
})
export class MapaRiesgoComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly contenedor = viewChild.required<ElementRef<HTMLDivElement>>('contenedor');

  readonly paises = input.required<PaisMapa[]>();

  protected readonly niveles = (Object.keys(NIVELES_RIESGO) as NivelRiesgo[]).map((nivel) => ({
    nivel,
    ...NIVELES_RIESGO[nivel],
  }));
  protected readonly errorGeo = signal(false);

  private readonly geojson = signal<GeoLatam | null>(null);
  private mapa: L.Map | null = null;
  private capa: L.GeoJSON<PropiedadesPais> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.mapa = L.map(this.contenedor().nativeElement, {
        zoomSnap: 0.25,
        scrollWheelZoom: false,
        attributionControl: true,
      });
      this.mapa.attributionControl.setPrefix(false).addAttribution('Geometrías: Natural Earth');
      const observador = new ResizeObserver(() => this.ajustarVista());
      observador.observe(this.contenedor().nativeElement);
      destroyRef.onDestroy(() => {
        observador.disconnect();
        this.mapa?.remove();
        this.mapa = null;
      });
      this.http.get<GeoLatam>(URL_GEOJSON).subscribe({
        next: (geo) => this.geojson.set(geo),
        error: () => this.errorGeo.set(true),
      });
    });

    effect(() => {
      const geo = this.geojson();
      const paises = this.paises();
      if (geo && this.mapa) {
        this.pintar(geo, new Map(paises.map((p) => [p.codigo_iso, p])));
      }
    });
  }

  private pintar(geo: GeoLatam, paises: Map<string, PaisMapa>): void {
    const mapa = this.mapa;
    if (!mapa) {
      return;
    }
    this.capa?.remove();
    const estilo = (feature?: Feature<Geometry, PropiedadesPais>): L.PathOptions => {
      const pais = feature ? paises.get(feature.properties.iso_a2) : undefined;
      return {
        fillColor: pais?.color ?? COLOR_NO_MONITOREADO,
        fillOpacity: pais ? 0.9 : 0.7,
        color: COLOR_BORDE,
        weight: 1.5,
      };
    };

    this.capa = L.geoJSON<PropiedadesPais>(geo, {
      style: estilo,
      onEachFeature: (feature, layer) => {
        const pais = paises.get(feature.properties.iso_a2);
        if (!(layer instanceof L.Path)) {
          return;
        }
        if (!pais) {
          layer.bindTooltip(`${feature.properties.nombre} · no monitoreado`, { sticky: true });
          return;
        }
        layer.bindTooltip(pais.nombre, { sticky: true });
        layer.bindPopup(() => crearPopupPais(pais, (iso) => this.verDetalle(iso)), {
          className: 'popup-riesgo',
          maxWidth: 260,
        });
        layer.on('popupopen', () => layer.closeTooltip());
        layer.on('mouseover', () =>
          layer.setStyle({ weight: 2.5, color: COLOR_RESALTE }).bringToFront(),
        );
        layer.on('mouseout', () => layer.setStyle(estilo(feature)));
      },
    }).addTo(mapa);
    this.ajustarVista();
  }

  private ajustarVista(): void {
    if (!this.mapa || !this.capa) {
      return;
    }
    this.mapa.invalidateSize();
    this.mapa.fitBounds(this.capa.getBounds(), { padding: [8, 8] });
  }

  private verDetalle(iso: string): void {
    this.mapa?.closePopup();
    void this.router.navigate(['/paises', iso]);
  }
}
