import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

// create access token
const accessToken = 'eyJ1IjoidGVzdHVzZXIiLCJpIjoiTFZwaWFSWUlyRnFKbndRTDlpR3RYIn0.QKwZXimsJ0ivyhlJBEutX5QHiPhbd6fpt9YafOYcmaZPnba0yO5ndnHUzjIRtCDTPGJRs8QdOzMOvuFHxtkZMg'
// setup map style
const style = {
  'version': 1,
  'name': 'raster-demo',
  'center': [0, 0],
  'zoom': -0.5,
  'minzoom': -1.5,
  'maxzoom': 5.25,
  'zoom-offset': 0.5,
  'sources': {
    'satellite': 's2maps://data/s2maps/modis-v1/7.s2tiles'
  },
  'wallpaper': {
    'skybox': 'https://data.s2maps.io/public/backgrounds/milkyway',
    'loadingBackground': 'rgb(9, 8, 17)',
    'size': 2048,
    'type': 'webp'
  },
  'layers': [
    {
      'name': 'background',
      'type': 'fill',
      'source': 'mask',
      'layout': {},
      'paint': {
        'color': 'rgb(9, 8, 17)'
      }
    },
    {
      'name': 'sat',
      'source': 'satellite',
      'type': 'raster'
    },
    {
      'name': 'shade',
      'source': 'mask',
      'type': 'shade',
      'maxzoom': 2
    }
  ]
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  // its important myCanvas matches the variable name in the template
  @ViewChild('container')
  container: ElementRef<HTMLElement>;

  public container: HTMLElement;

  ngAfterViewInit(): void {
    new S2Map({
      style,
      apiKey: accessToken,
      container,
      zoomController: true
    })
  }
}
