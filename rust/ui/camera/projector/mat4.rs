use bytemuck::{Pod, Zeroable};
use core::ops::{Mul, Sub};
use gistools::geometry::S2Point;
use libm::{cos, fabs, fmax, sin, sqrt, tan};

/// 4 dimensional vector
/// X, Y, Z, T
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
pub struct Vec4(pub [f32; 4]);
impl Vec4 {
    /// Create a new vector
    pub fn new(x: f32, y: f32, z: f32, t: f32) -> Vec4 {
        Vec4([x, y, z, t])
    }
    /// Create a new vector with only x and y
    pub fn new_xy(x: f32, y: f32) -> Vec4 {
        Vec4([x, y, 0., 0.])
    }
    /// Get x
    pub fn x(self) -> f32 {
        self.0[0]
    }
    /// Set X
    pub fn set_x(&mut self, x: f32) {
        self.0[0] = x;
    }
    /// Get y
    pub fn y(self) -> f32 {
        self.0[1]
    }
    /// Set y
    pub fn set_y(&mut self, y: f32) {
        self.0[1] = y;
    }
    /// Get z
    pub fn z(self) -> f32 {
        self.0[2]
    }
    /// Get t
    pub fn t(self) -> f32 {
        self.0[3]
    }
}
impl From<&S2Point> for Vec4 {
    fn from(value: &S2Point) -> Self {
        Vec4([value.x as f32, value.y as f32, value.z as f32, 0.])
    }
}
impl Sub for Vec4 {
    type Output = Vec4;

    fn sub(self, rhs: Self) -> Self::Output {
        Vec4([
            self.0[0] - rhs.0[0],
            self.0[1] - rhs.0[1],
            self.0[2] - rhs.0[2],
            self.0[3] - rhs.0[3],
        ])
    }
}
impl Mul<f32> for Vec4 {
    type Output = Vec4;

    fn mul(self, rhs: f32) -> Self::Output {
        Vec4([self.0[0] * rhs, self.0[1] * rhs, self.0[2] * rhs, self.0[3] * rhs])
    }
}

/// 4x4 matrix
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
pub struct Mat4(pub [f32; 16]);
impl Mat4 {
    /// Create a new 4x4 identity matrix
    pub fn new() -> Mat4 {
        Mat4::identity()
    }

    /// Create a new 4x4 identity matrix
    pub fn identity() -> Mat4 {
        Mat4([1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0])
    }

    /**
     * Prepare an Blend matrix
     * @param m - input matrix
     * @param width - viewport width
     * @param height - viewport height
     * @param near - near plane
     * @param far - far plane
     * @returns the blended matrix
     */
    pub fn blend(width: f32, height: f32, near: f32, far: f32) -> Mat4 {
        let mut res = Mat4([0.; 16]);
        res.0[0] = 1. / width;
        res.0[5] = 1. / height;
        res.0[11] = -1.;
        if far.is_finite() {
            let nf = 1. / (near - far);
            res.0[10] = (far + near) * nf;
            res.0[14] = 2. * far * near * nf;
        } else {
            res.0[10] = -1.;
            res.0[14] = -2. * near;
        }

        res
    }

    /**
     * Prepare an Orthographic projection matrix
     * @param m - input matrix
     * @param width - viewport width
     * @param height - viewport height
     * @param far - far plane
     * @returns the orthographic matrix
     */
    pub fn ortho(width: f32, height: f32, far: f32) -> Mat4 {
        let mut res = Mat4([0.; 16]);
        res.0[0] = 1. / width;
        res.0[5] = 1. / height;
        res.0[10] = -1. / far;
        res.0[15] = 1.;

        res
    }

    /**
     * Prepare a perspective projection matrix
     * @param m - input matrix
     * @param fovy - field of view
     * @param aspect - viewport aspect
     * @param near - near plane
     * @param far - far plane
     * @returns the perspective matrix
     */
    pub fn perspective(fovy: f32, aspect: f32, near: f32, far: f32) -> Mat4 {
        let mut res = Mat4([0.; 16]);
        let f = (1. / tan(fovy as f64 / 2.)) as f32;
        res.0[0] = f / aspect;
        res.0[5] = f;
        res.0[11] = -1.;
        if far.is_finite() {
            let nf = 1. / (near - far);
            res.0[10] = (far + near) * nf;
            res.0[14] = 2. * far * near * nf;
        } else {
            res.0[10] = -1.;
            res.0[14] = -2. * near;
        }

        res
    }

    /**
     * Prepare a look_at matrix
     * @param eye - camera position
     * @param up - camera up vector
     * @returns the look_at matrix
     */
    pub fn look_at(eye: &Vec4, up: &Vec4) -> Mat4 {
        let mut m = Mat4([0.; 16]);
        let mut x0: f32;
        let mut x1: f32;
        let mut x2: f32;
        let mut y0: f32;
        let mut y1: f32;
        let mut y2: f32;
        let mut z0: f32;
        let mut z1: f32;
        let mut z2: f32;
        let mut len: f32;
        let Vec4([eyex, eyey, eyez, _]) = *eye;
        let Vec4([upx, upy, upz, _]) = *up;

        z0 = eyex;
        z1 = eyey;
        z2 = eyez;
        len = 1. / hypot3(z0, z1, z2);
        z0 *= len;
        z1 *= len;
        z2 *= len;
        x0 = upy * z2 - upz * z1;
        x1 = upz * z0 - upx * z2;
        x2 = upx * z1 - upy * z0;
        len = hypot3(x0, x1, x2);

        if len == 0. {
            x0 = 0.;
            x1 = 0.;
            x2 = 0.;
        } else {
            len = 1. / len;
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }

        y0 = z1 * x2 - z2 * x1;
        y1 = z2 * x0 - z0 * x2;
        y2 = z0 * x1 - z1 * x0;
        len = hypot3(y0, y1, y2);

        if len == 0. {
            y0 = 0.;
            y1 = 0.;
            y2 = 0.;
        } else {
            len = 1. / len;
            y0 *= len;
            y1 *= len;
            y2 *= len;
        }

        m.0[0] = x0;
        m.0[1] = y0;
        m.0[2] = z0;
        m.0[3] = 0.;
        m.0[4] = x1;
        m.0[5] = y1;
        m.0[6] = z1;
        m.0[7] = 0.;
        m.0[8] = x2;
        m.0[9] = y2;
        m.0[10] = z2;
        m.0[11] = 0.;
        m.0[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
        m.0[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
        m.0[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
        m.0[15] = 1.;

        m
    }

    /**
     * Add a center to the matrix
     * @param m - input matrix
     * @param v - center vector
     * @returns the matrix
     */
    pub fn add_center(&mut self, v: &Vec4) {
        self.0[12] = v.0[0];
        self.0[13] = v.0[1];
        self.0[14] = v.0[2];
        self.0[15] = v.0[3];
    }

    /**
     * Translate the matrix given a vector
     * @param m - input matrix
     * @param v - vector
     * @returns the matrix
     */
    pub fn translate(&mut self, v: &Vec4) {
        let Vec4([x, y, z, _]) = v;

        self.0[12] = self.0[0] * x + self.0[4] * y + self.0[8] * z + self.0[12];
        self.0[13] = self.0[1] * x + self.0[5] * y + self.0[9] * z + self.0[13];
        self.0[14] = self.0[2] * x + self.0[6] * y + self.0[10] * z + self.0[14];
        self.0[15] = self.0[3] * x + self.0[7] * y + self.0[11] * z + self.0[15];
    }

    /**
     * Scale the matrix via a vector
     * @param m - input matrix
     * @param v - vector
     * @returns the matrix
     */
    pub fn scale(&mut self, v: &Vec4) {
        let Vec4([x, y, z, _]) = *v;

        self.0[0] = self.0[0] * x;
        self.0[1] = self.0[1] * x;
        self.0[2] = self.0[2] * x;
        self.0[3] = self.0[3] * x;
        self.0[4] = self.0[4] * y;
        self.0[5] = self.0[5] * y;
        self.0[6] = self.0[6] * y;
        self.0[7] = self.0[7] * y;
        self.0[8] = self.0[8] * z;
        self.0[9] = self.0[9] * z;
        self.0[10] = self.0[10] * z;
        self.0[11] = self.0[11] * z;
    }

    /**
     * Rotate the matrix
     * @param m - input matrix
     * @param rad - rotation in radians
     * @returns the matrix
     */
    pub fn rotate(&mut self, rad: &Vec4) {
        self.rotate_x(rad.0[0]);
        self.rotate_y(rad.0[1]);
        self.rotate_z(rad.0[2]);
    }

    /**
     * Rotate the matrix around the X axis
     * @param m - input matrix
     * @param rad - rotation in radians
     * @returns the matrix
     */
    pub fn rotate_x(&mut self, rad: f32) {
        let s = sin(rad as f64) as f32;
        let c = cos(rad as f64) as f32;
        let m10 = self.0[4];
        let m11 = self.0[5];
        let m12 = self.0[6];
        let m13 = self.0[7];
        let m20 = self.0[8];
        let m21 = self.0[9];
        let m22 = self.0[10];
        let m23 = self.0[11];
        // Perform axis-specific matrix multiplication
        self.0[4] = m10 * c + m20 * s;
        self.0[5] = m11 * c + m21 * s;
        self.0[6] = m12 * c + m22 * s;
        self.0[7] = m13 * c + m23 * s;
        self.0[8] = m20 * c - m10 * s;
        self.0[9] = m21 * c - m11 * s;
        self.0[10] = m22 * c - m12 * s;
        self.0[11] = m23 * c - m13 * s;
    }

    /**
     * Rotate the matrix around the Y axis
     * @param m - input matrix
     * @param rad - rotation in radians
     * @returns the matrix
     */
    pub fn rotate_y(&mut self, rad: f32) {
        let s = sin(rad as f64) as f32;
        let c = cos(rad as f64) as f32;
        let m00 = self.0[0];
        let m01 = self.0[1];
        let m02 = self.0[2];
        let m03 = self.0[3];
        let m20 = self.0[8];
        let m21 = self.0[9];
        let m22 = self.0[10];
        let m23 = self.0[11];
        // Perform axis-specific matrix multiplication
        self.0[0] = m00 * c - m20 * s;
        self.0[1] = m01 * c - m21 * s;
        self.0[2] = m02 * c - m22 * s;
        self.0[3] = m03 * c - m23 * s;
        self.0[8] = m00 * s + m20 * c;
        self.0[9] = m01 * s + m21 * c;
        self.0[10] = m02 * s + m22 * c;
        self.0[11] = m03 * s + m23 * c;
    }

    /**
     * Rotate the matrix around the Z axis
     * @param m - input matrix
     * @param rad - rotation in radians
     * @returns the matrix
     */
    pub fn rotate_z(&mut self, rad: f32) {
        let s = sin(rad as f64) as f32;
        let c = cos(rad as f64) as f32;
        let m00 = self.0[0];
        let m01 = self.0[1];
        let m02 = self.0[2];
        let m03 = self.0[3];
        let m10 = self.0[4];
        let m11 = self.0[5];
        let m12 = self.0[6];
        let m13 = self.0[7];
        // Perform axis-specific matrix multiplication
        self.0[0] = m00 * c + m10 * s;
        self.0[1] = m01 * c + m11 * s;
        self.0[2] = m02 * c + m12 * s;
        self.0[3] = m03 * c + m13 * s;
        self.0[4] = m10 * c - m00 * s;
        self.0[5] = m11 * c - m01 * s;
        self.0[6] = m12 * c - m02 * s;
        self.0[7] = m13 * c - m03 * s;
    }

    /**
     * Multiply a matrix by a vector
     * @param m - input matrix
     * @param v - vector
     * @returns the vector
     */
    pub fn multiply_vector(&self, v: &Vec4) -> Vec4 {
        let Vec4([x, y, z, _]) = *v;
        Vec4([
            self.0[0] * x + self.0[4] * y + self.0[8] * z + self.0[12],
            self.0[1] * x + self.0[5] * y + self.0[9] * z + self.0[13],
            self.0[2] * x + self.0[6] * y + self.0[10] * z + self.0[14],
            self.0[3] * x + self.0[7] * y + self.0[11] * z + self.0[15],
        ])
    }

    /**
     * Multiply a second matrix to self
     * @param b - input matrix
     * @returns the matrix
     */
    pub fn multiply(&mut self, b: &Mat4) {
        let a00 = self.0[0];
        let a01 = self.0[1];
        let a02 = self.0[2];
        let a03 = self.0[3];
        let a10 = self.0[4];
        let a11 = self.0[5];
        let a12 = self.0[6];
        let a13 = self.0[7];
        let a20 = self.0[8];
        let a21 = self.0[9];
        let a22 = self.0[10];
        let a23 = self.0[11];
        let a30 = self.0[12];
        let a31 = self.0[13];
        let a32 = self.0[14];
        let a33 = self.0[15];
        // Cache only the current line of the second matrix
        let mut b0 = b.0[0];
        let mut b1 = b.0[1];
        let mut b2 = b.0[2];
        let mut b3 = b.0[3];
        self.0[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        self.0[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        self.0[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        self.0[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        b0 = b.0[4];
        b1 = b.0[5];
        b2 = b.0[6];
        b3 = b.0[7];
        self.0[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        self.0[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        self.0[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        self.0[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        b0 = b.0[8];
        b1 = b.0[9];
        b2 = b.0[10];
        b3 = b.0[11];
        self.0[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        self.0[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        self.0[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        self.0[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
        b0 = b.0[12];
        b1 = b.0[13];
        b2 = b.0[14];
        b3 = b.0[15];
        self.0[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        self.0[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        self.0[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        self.0[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }

    /**
     * Invert a matrix. Clones the original and returns the inverted if it is invertible
     *
     * ## Parameters
     * - `matrix`: input matrix
     *
     * ## Returns
     * the inverted matrix if possible, None otherwise
     */
    pub fn invert(&mut self) -> Option<Mat4> {
        let a00 = self.0[0];
        let a01 = self.0[1];
        let a02 = self.0[2];
        let a03 = self.0[3];
        let a10 = self.0[4];
        let a11 = self.0[5];
        let a12 = self.0[6];
        let a13 = self.0[7];
        let a20 = self.0[8];
        let a21 = self.0[9];
        let a22 = self.0[10];
        let a23 = self.0[11];
        let a30 = self.0[12];
        let a31 = self.0[13];
        let a32 = self.0[14];
        let a33 = self.0[15];

        let b00 = a00 * a11 - a01 * a10;
        let b01 = a00 * a12 - a02 * a10;
        let b02 = a00 * a13 - a03 * a10;
        let b03 = a01 * a12 - a02 * a11;
        let b04 = a01 * a13 - a03 * a11;
        let b05 = a02 * a13 - a03 * a12;
        let b06 = a20 * a31 - a21 * a30;
        let b07 = a20 * a32 - a22 * a30;
        let b08 = a20 * a33 - a23 * a30;
        let b09 = a21 * a32 - a22 * a31;
        let b10 = a21 * a33 - a23 * a31;
        let b11 = a22 * a33 - a23 * a32;
        // Calculate the determinant
        let mut det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if det == 0. {
            return None;
        }
        det = 1. / det;

        let mut res = self.clone();
        res.0[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        res.0[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        res.0[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        res.0[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        res.0[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        res.0[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        res.0[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        res.0[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        res.0[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        res.0[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        res.0[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        res.0[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        res.0[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        res.0[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        res.0[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        res.0[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

        Some(res)
    }

    /**
     * Project a 3D vector given an input matrix
     * @param matrix - input matrix
     * @param vector - vector to project
     * @returns the projected vector
     */
    pub fn project(&self, vector: &Vec4) -> Vec4 {
        let mut res = self.multiply_vector(vector);
        let t = res.0[3];

        res.0[0] /= t;
        res.0[1] /= t;
        res.0[2] /= t;
        res.0[3] /= t;

        res
    }
}

fn hypot3(x: f32, y: f32, z: f32) -> f32 {
    let x = fabs(x as f64);
    let y = fabs(y as f64);
    let z = fabs(z as f64);

    // Find max to scale and avoid overflow
    let max = fmax(fmax(y, x), z);
    if max == 0.0 {
        0.0
    } else {
        (max * sqrt((x / max) * (x / max) + (y / max) * (y / max) + (z / max) * (z / max))) as f32
    }
}
