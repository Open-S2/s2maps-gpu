use crate::util::{Duration, Instant};
use alloc::vec::Vec;
use libm::{fabs, hypot};

// const DOUBLE_CLICK_TIMEOUT: u128 = 175;
const DOUBLE_CLICK_TIMEOUT: Duration = Duration::from_millis(175);

/// An interface that models the touch event items we are interested in
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct TouchEvent {
    /// X position of the touch relative to the UI's position
    pub client_x: f64,
    /// Y position of the touch relative to the UI's position
    pub client_y: f64,
    /// X position of the touch relative to the map
    pub x: f64,
    /// Y position of the touch relative to the map
    pub y: f64,
}

/// An interface that models the touch event items we are interested in
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TouchType {
    /// User has just touched the screen
    TouchStart,
    /// User has let go
    TouchEnd,
    /// User is dragging
    TouchMove,
}

/// An interface that models the user touch event items we are interested in
#[derive(Debug, Default, Clone, PartialEq)]
pub struct UserTouchEvent(Vec<TouchEvent>);
impl UserTouchEvent {
    /// Create a new user touch event
    pub fn new(touches: Vec<TouchEvent>) -> Self {
        Self(touches)
    }
    /// Get the number of touches
    pub fn len(&self) -> usize {
        self.0.len()
    }
    /// Check if the collection is empty
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// An interface that models the click event items we are interested in
#[derive(Debug, Default, Clone, PartialEq)]
pub struct ClickEvent {
    /// X position of the click
    pub pos_x: f64,
    /// Y position of the click
    pub pos_y: f64,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum DragPanEvent {
    Move,
    Swipe,
    Zoom,
    Click(ClickEvent),
    DoubleClick(ClickEvent),
}

/// # DragPan
///
/// ## Description
/// DragPan is a class that handles mouse and touch events for panning and zooming
///
/// ## Example
/// ```ts
/// const dragPan = new DragPan()
/// dragPan.addEventListener('move', () => {
///  console.info(dragPan.movement_x, dragPan.movement_y)
/// })
/// ```
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct DragPan {
    zoom_active: bool,  // allow two finger zooming
    mouse_active: bool, // when a user presses left click and moves during the press
    min_movement_x: f64,
    min_movement_y: f64,
    movement_x: f64,
    movement_y: f64,
    total_movement_x: f64,
    total_movement_y: f64,
    touch_delta_x: f64,
    touch_delta_y: f64,
    touch_delta_z: f64,
    last_click_event: ClickEvent,
    last_click: Option<Instant>,
    zoom: f64,
    listeners: Vec<fn(event: &DragPanEvent)>,
}
impl DragPan {
    /// Create a new Drag Pan Handler
    pub fn new() -> Self {
        DragPan {
            zoom_active: false,
            mouse_active: false,
            min_movement_x: 1.,
            min_movement_y: 0.5,
            ..Default::default()
        }
    }

    /// Clears all previous movement and zoom changes
    pub fn clear(&mut self) {
        self.movement_x = 0.;
        self.movement_y = 0.;
        self.total_movement_x = 0.;
        self.total_movement_y = 0.;
        self.zoom = 0.;
    }

    /// Add an event listener
    pub fn add_event_listener(&mut self, callback: fn(event: &DragPanEvent)) {
        self.listeners.push(callback);
    }

    fn dispatch_event(&self, event: DragPanEvent) {
        self.listeners.iter().for_each(|callback| callback(&event));
    }

    /// Beginning of a touch event, user has just touched the screen
    ///
    /// ## Parameters
    /// - `touches`: collection of touch events
    pub fn on_touch_start(&mut self, touches: &UserTouchEvent) {
        self.set_touch_delta(touches);
        self.mouse_active = true;
    }

    /// User has let go, we don't know if it was a swipe, a click, or a double click
    ///
    /// ## Parameters
    /// - `touches`: collection of touch events
    pub fn on_touch_end(&mut self, touches: &UserTouchEvent) {
        self.set_touch_delta(touches);
        if fabs(self.total_movement_x) < self.min_movement_x
            && fabs(self.total_movement_y) < self.min_movement_y
        {
            let TouchEvent { client_x, client_y, .. } = *touches.0.first().unwrap();
            self.handle_click(ClickEvent { pos_x: client_x, pos_y: client_y });
        }
    }

    /// User is actively moving their fingers
    ///
    /// ## Parameters
    /// - `touches`: collection of touch events
    fn set_touch_delta(&mut self, touches: &UserTouchEvent) {
        let length = touches.len();
        if length != 0 {
            let TouchEvent { mut client_x, mut client_y, .. } = *touches.0.first().unwrap();
            self.touch_delta_x = client_x;
            self.touch_delta_y = client_y;
            if length > 1 && self.zoom_active {
                let last = touches.0.last().unwrap();
                client_x = last.client_x;
                client_y = last.client_y;
                self.touch_delta_z =
                    hypot(self.touch_delta_x - client_x, self.touch_delta_y - client_y);
            } else {
                self.clear();
            }
        } else {
            self.on_mouse_up(0., 0.);
        }
    }

    /// User is using a mouse and just clicked. set to active and set starting movement
    pub fn on_mouse_down(&mut self) {
        self.mouse_active = true;
        self.clear();
    }

    /// User has let go of the left mouse button
    ///
    /// ## Parameters
    /// - `pos_x`: x position of the click
    /// - `pos_y`: y position of the click
    pub fn on_mouse_up(&mut self, pos_x: f64, pos_y: f64) {
        self.mouse_active = false;
        // if movement is greater than mins, animate swipe,
        // otherwise if total movement is less than mins it's considered a click
        if fabs(self.movement_x) > self.min_movement_x
            || fabs(self.movement_y) > self.min_movement_y
        {
            self.dispatch_event(DragPanEvent::Swipe); // new Event('swipe'));
        } else if fabs(self.total_movement_x) < self.min_movement_x
            && fabs(self.total_movement_y) < self.min_movement_y
        {
            self.handle_click(ClickEvent { pos_x, pos_y });
        }
    }

    /// Handles a click input
    fn handle_click(&mut self, click: ClickEvent) {
        let now = Instant::now();
        if let Some(last) = self.last_click
            && now.duration_since(last) < DOUBLE_CLICK_TIMEOUT
        {
            self.last_click = None;
            self.dispatch_event(DragPanEvent::DoubleClick(click));
        } else {
            self.last_click = Some(now);
            self.dispatch_event(DragPanEvent::Click(click));
        }
    }

    /// tracks movement if the left click actively pressed
    /// or it tracks what features are currently active
    ///
    /// ## Parameters
    /// - `movement_x`: the change in x position
    /// - `movement_y`: the change in y position
    pub fn on_mouse_move(&mut self, movement_x: f64, movement_y: f64) {
        if self.mouse_active {
            self.movement_x = movement_x;
            self.movement_y = movement_y;
            self.total_movement_x += movement_x;
            self.total_movement_y += movement_y;
            self.dispatch_event(DragPanEvent::Move);
        }
    }

    /// User is using a touch screen and is actively moving their finger(s)
    ///
    /// ## Parameters
    /// - `touches`: collection of touch events
    pub fn on_touch_move(&mut self, touches: &UserTouchEvent) {
        let length = touches.len();
        if length == 0 {
            return;
        }
        let TouchEvent { mut client_x, mut client_y, .. } = *touches.0.first().unwrap();
        if length > 1 && self.zoom_active {
            // zoom
            // update new position of first finger
            self.touch_delta_x = client_x;
            self.touch_delta_y = client_y;
            // get position of last finger
            let last = touches.0.last().unwrap();
            client_x = last.client_x;
            client_y = last.client_y;
            // set change in finger distance
            let delta_z = hypot(self.touch_delta_x - client_x, self.touch_delta_y - client_y);
            self.zoom = (self.touch_delta_z - delta_z) * 2.;
            self.dispatch_event(DragPanEvent::Zoom);
            self.touch_delta_z = delta_z;
        } else if self.mouse_active {
            // move
            let delta_x = client_x - self.touch_delta_x;
            let delta_y = client_y - self.touch_delta_y;
            self.movement_x = delta_x;
            self.movement_y = delta_y;
            self.total_movement_x += delta_x;
            self.total_movement_y += delta_y;
            // set new position
            self.touch_delta_x = client_x;
            self.touch_delta_y = client_y;
            self.dispatch_event(DragPanEvent::Move);
        }
    }
}
