// Copyright (C) [2022] World Wide Web Consortium,
// (Massachusetts Institute of Technology, European Research Consortium for
// Informatics and Mathematics, Keio University, Beihang).
// All Rights Reserved.
//
// This work is distributed under the W3C (R) Software License [1] in the hope
// that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
// warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//
// [1] http://www.w3.org/Consortium/Legal/copyright-software

// **** This file is auto-generated. Do not edit. ****

module.exports = grammar({
    name: 'wgsl',

    externals: $ => [
        $._block_comment,
    ],

    extras: $ => [
        $._comment,
        $._block_comment,
        $._space,
    ],

    inline: $ => [
        $.global_decl,
        $._reserved,
    ],

    conflicts: $ => [
        [$.type_decl,$.primary_expression],
    ],

    word: $ => $.ident,

    rules: {
        translation_unit: $ => seq(optional(repeat1($.global_directive)), optional(repeat1($.global_decl))),
        global_directive: $ => $.enable_directive,
        global_decl: $ => choice(
            $.semicolon,
            seq($.global_variable_decl, $.semicolon),
            seq($.global_constant_decl, $.semicolon),
            seq($.type_alias_decl, $.semicolon),
            $.struct_decl,
            $.function_decl
        ),
        decimal_float_literal: $ => token(/((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?f?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+f?)/),
        hex_float_literal: $ => token(/-?0[xX]((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+f?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+f?))/),
        int_literal: $ => token(/-?0[xX][0-9a-fA-F]+|0|-?[1-9][0-9]*/),
        uint_literal: $ => token(/0[xX][0-9a-fA-F]+u|0u|[1-9][0-9]*u/),
        const_literal: $ => choice(
            $.int_literal,
            $.uint_literal,
            $.float_literal,
            $.true,
            $.false
        ),
        float_literal: $ => choice(
            $.decimal_float_literal,
            $.hex_float_literal
        ),
        attribute: $ => choice(
            seq($.attr, $.ident, $.paren_left, optional(repeat1(seq($.literal_or_ident, $.comma))), $.literal_or_ident, $.paren_right),
            seq($.attr, $.ident)
        ),
        literal_or_ident: $ => choice(
            $.float_literal,
            $.int_literal,
            $.uint_literal,
            $.ident
        ),
        array_type_decl: $ => seq($.array, $.less_than, $.type_decl, optional(seq($.comma, $.element_count_expression)), $.greater_than),
        element_count_expression: $ => choice(
            $.int_literal,
            $.uint_literal,
            $.ident
        ),
        struct_decl: $ => seq($.struct, $.ident, $.struct_body_decl),
        struct_body_decl: $ => seq($.brace_left, optional(repeat1($.struct_member)), $.brace_right),
        struct_member: $ => seq(optional(repeat1($.attribute)), $.variable_ident_decl, $.semicolon),
        address_space: $ => choice(
            $.function,
            $.private,
            $.workgroup,
            $.uniform,
            $.storage
        ),
        texture_sampler_types: $ => choice(
            $.sampler_type,
            $.depth_texture_type,
            seq($.sampled_texture_type, $.less_than, $.type_decl, $.greater_than),
            seq($.multisampled_texture_type, $.less_than, $.type_decl, $.greater_than),
            seq($.storage_texture_type, $.less_than, $.texel_format, $.comma, $.access_mode, $.greater_than)
        ),
        sampler_type: $ => choice(
            $.sampler,
            $.sampler_comparison
        ),
        sampled_texture_type: $ => choice(
            $.texture_1d,
            $.texture_2d,
            $.texture_2d_array,
            $.texture_3d,
            $.texture_cube,
            $.texture_cube_array
        ),
        multisampled_texture_type: $ => $.texture_multisampled_2d,
        storage_texture_type: $ => choice(
            $.texture_storage_1d,
            $.texture_storage_2d,
            $.texture_storage_2d_array,
            $.texture_storage_3d
        ),
        depth_texture_type: $ => choice(
            $.texture_depth_2d,
            $.texture_depth_2d_array,
            $.texture_depth_cube,
            $.texture_depth_cube_array,
            $.texture_depth_multisampled_2d
        ),
        type_alias_decl: $ => seq($.type, $.ident, $.equal, $.type_decl),
        type_decl: $ => choice(
            $.ident,
            $.bool,
            $.float32,
            $.int32,
            $.uint32,
            seq($.vec2, $.less_than, $.type_decl, $.greater_than),
            seq($.vec3, $.less_than, $.type_decl, $.greater_than),
            seq($.vec4, $.less_than, $.type_decl, $.greater_than),
            seq($.pointer, $.less_than, $.address_space, $.comma, $.type_decl, optional(seq($.comma, $.access_mode)), $.greater_than),
            $.array_type_decl,
            seq($.mat2x2, $.less_than, $.type_decl, $.greater_than),
            seq($.mat2x3, $.less_than, $.type_decl, $.greater_than),
            seq($.mat2x4, $.less_than, $.type_decl, $.greater_than),
            seq($.mat3x2, $.less_than, $.type_decl, $.greater_than),
            seq($.mat3x3, $.less_than, $.type_decl, $.greater_than),
            seq($.mat3x4, $.less_than, $.type_decl, $.greater_than),
            seq($.mat4x2, $.less_than, $.type_decl, $.greater_than),
            seq($.mat4x3, $.less_than, $.type_decl, $.greater_than),
            seq($.mat4x4, $.less_than, $.type_decl, $.greater_than),
            seq($.atomic, $.less_than, $.type_decl, $.greater_than),
            $.texture_sampler_types
        ),
        variable_statement: $ => choice(
            $.variable_decl,
            seq($.variable_decl, $.equal, $.expression),
            seq($.let, choice($.ident, $.variable_ident_decl), $.equal, $.expression)
        ),
        variable_decl: $ => seq($.var, optional($.variable_qualifier), choice($.ident, $.variable_ident_decl)),
        variable_ident_decl: $ => seq($.ident, $.colon, $.type_decl),
        variable_qualifier: $ => seq($.less_than, $.address_space, optional(seq($.comma, $.access_mode)), $.greater_than),
        global_variable_decl: $ => seq(optional(repeat1($.attribute)), $.variable_decl, optional(seq($.equal, $.const_expression))),
        global_constant_decl: $ => choice(
            seq($.let, choice($.ident, $.variable_ident_decl), $.equal, $.const_expression),
            seq(optional(repeat1($.attribute)), $.override, choice($.ident, $.variable_ident_decl), optional(seq($.equal, $.expression)))
        ),
        const_expression: $ => choice(
            seq($.type_decl, $.paren_left, optional(seq(optional(repeat1(seq($.const_expression, $.comma))), $.const_expression, optional($.comma))), $.paren_right),
            $.const_literal
        ),
        primary_expression: $ => choice(
            seq($.ident, optional($.argument_expression_list)),
            seq($.type_decl, $.argument_expression_list),
            $.const_literal,
            $.paren_expression,
            seq($.bitcast, $.less_than, $.type_decl, $.greater_than, $.paren_expression)
        ),
        paren_expression: $ => seq($.paren_left, $.expression, $.paren_right),
        argument_expression_list: $ => seq($.paren_left, optional(seq(optional(repeat1(seq($.expression, $.comma))), $.expression, optional($.comma))), $.paren_right),
        postfix_expression: $ => choice(
            seq($.bracket_left, $.expression, $.bracket_right, optional($.postfix_expression)),
            seq($.period, $.ident, optional($.postfix_expression))
        ),
        unary_expression: $ => choice(
            $.singular_expression,
            seq($.minus, $.unary_expression),
            seq($.bang, $.unary_expression),
            seq($.tilde, $.unary_expression),
            seq($.star, $.unary_expression),
            seq($.and, $.unary_expression)
        ),
        singular_expression: $ => seq($.primary_expression, optional($.postfix_expression)),
        lhs_expression: $ => seq(optional(repeat1(choice($.star, $.and))), $.core_lhs_expression, optional($.postfix_expression)),
        core_lhs_expression: $ => choice(
            $.ident,
            seq($.paren_left, $.lhs_expression, $.paren_right)
        ),
        multiplicative_expression: $ => choice(
            $.unary_expression,
            seq($.multiplicative_expression, $.star, $.unary_expression),
            seq($.multiplicative_expression, $.forward_slash, $.unary_expression),
            seq($.multiplicative_expression, $.modulo, $.unary_expression)
        ),
        additive_expression: $ => choice(
            $.multiplicative_expression,
            seq($.additive_expression, $.plus, $.multiplicative_expression),
            seq($.additive_expression, $.minus, $.multiplicative_expression)
        ),
        shift_expression: $ => choice(
            $.additive_expression,
            seq($.unary_expression, $.shift_left, $.unary_expression),
            seq($.unary_expression, $.shift_right, $.unary_expression)
        ),
        relational_expression: $ => choice(
            $.shift_expression,
            seq($.shift_expression, $.less_than, $.shift_expression),
            seq($.shift_expression, $.greater_than, $.shift_expression),
            seq($.shift_expression, $.less_than_equal, $.shift_expression),
            seq($.shift_expression, $.greater_than_equal, $.shift_expression),
            seq($.shift_expression, $.equal_equal, $.shift_expression),
            seq($.shift_expression, $.not_equal, $.shift_expression)
        ),
        short_circuit_and_expression: $ => choice(
            $.relational_expression,
            seq($.short_circuit_and_expression, $.and_and, $.relational_expression)
        ),
        short_circuit_or_expression: $ => choice(
            $.relational_expression,
            seq($.short_circuit_or_expression, $.or_or, $.relational_expression)
        ),
        binary_or_expression: $ => choice(
            $.unary_expression,
            seq($.binary_or_expression, $.or, $.unary_expression)
        ),
        binary_and_expression: $ => choice(
            $.unary_expression,
            seq($.binary_and_expression, $.and, $.unary_expression)
        ),
        binary_xor_expression: $ => choice(
            $.unary_expression,
            seq($.binary_xor_expression, $.xor, $.unary_expression)
        ),
        expression: $ => choice(
            $.relational_expression,
            seq($.short_circuit_or_expression, $.or_or, $.relational_expression),
            seq($.short_circuit_and_expression, $.and_and, $.relational_expression),
            seq($.binary_and_expression, $.and, $.unary_expression),
            seq($.binary_or_expression, $.or, $.unary_expression),
            seq($.binary_xor_expression, $.xor, $.unary_expression)
        ),
        compound_statement: $ => seq($.brace_left, optional(repeat1($.statement)), $.brace_right),
        assignment_statement: $ => choice(
            seq($.lhs_expression, choice($.equal, $.compound_assignment_operator), $.expression),
            seq($.underscore, $.equal, $.expression)
        ),
        compound_assignment_operator: $ => choice(
            $.plus_equal,
            $.minus_equal,
            $.times_equal,
            $.division_equal,
            $.modulo_equal,
            $.and_equal,
            $.or_equal,
            $.xor_equal,
            $.shift_right_equal,
            $.shift_left_equal
        ),
        increment_statement: $ => seq($.lhs_expression, $.plus_plus),
        decrement_statement: $ => seq($.lhs_expression, $.minus_minus),
        if_statement: $ => seq($.if, $.paren_expression, $.compound_statement, optional(seq($.else, $.else_statement))),
        else_statement: $ => choice(
            $.compound_statement,
            $.if_statement
        ),
        switch_statement: $ => seq($.switch, $.paren_expression, $.brace_left, repeat1($.switch_body), $.brace_right),
        switch_body: $ => choice(
            seq($.case, $.case_selectors, $.colon, $.brace_left, optional($.case_body), $.brace_right),
            seq($.default, $.colon, $.brace_left, optional($.case_body), $.brace_right)
        ),
        case_selectors: $ => seq($.const_literal, optional(repeat1(seq($.comma, $.const_literal))), optional($.comma)),
        case_body: $ => choice(
            seq($.statement, optional($.case_body)),
            seq($.fallthrough, $.semicolon)
        ),
        loop_statement: $ => seq($.loop, $.brace_left, optional(repeat1($.statement)), optional($.continuing_statement), $.brace_right),
        for_statement: $ => seq($.for, $.paren_left, $.for_header, $.paren_right, $.compound_statement),
        for_header: $ => seq(optional($.for_init), $.semicolon, optional($.expression), $.semicolon, optional($.for_update)),
        for_init: $ => choice(
            $.variable_statement,
            $.assignment_statement,
            $.func_call_statement
        ),
        for_update: $ => choice(
            $.increment_statement,
            $.decrement_statement,
            $.assignment_statement,
            $.func_call_statement
        ),
        break_statement: $ => $.break,
        continue_statement: $ => $.continue,
        continuing_statement: $ => seq($.continuing, $.compound_statement),
        return_statement: $ => seq($.return, optional($.expression)),
        func_call_statement: $ => seq($.ident, $.argument_expression_list),
        statement: $ => choice(
            $.semicolon,
            seq($.return_statement, $.semicolon),
            $.if_statement,
            $.switch_statement,
            $.loop_statement,
            $.for_statement,
            seq($.func_call_statement, $.semicolon),
            seq($.variable_statement, $.semicolon),
            seq($.break_statement, $.semicolon),
            seq($.continue_statement, $.semicolon),
            seq($.discard, $.semicolon),
            seq($.assignment_statement, $.semicolon),
            $.compound_statement,
            seq($.increment_statement, $.semicolon),
            seq($.decrement_statement, $.semicolon)
        ),
        function_decl: $ => seq(optional(repeat1($.attribute)), $.function_header, $.compound_statement),
        function_header: $ => seq($.fn, $.ident, $.paren_left, optional($.param_list), $.paren_right, optional(seq($.arrow, optional(repeat1($.attribute)), $.type_decl))),
        param_list: $ => seq(optional(repeat1(seq($.param, $.comma))), $.param, optional($.comma)),
        param: $ => seq(optional(repeat1($.attribute)), $.variable_ident_decl),
        enable_directive: $ => seq($.enable, $.ident, $.semicolon),
        access_mode: $ => choice(
            token('read'),
            token('write'),
            token('read_write')
        ),
        texel_format: $ => choice(
            token('rgba8unorm'),
            token('rgba8snorm'),
            token('rgba8uint'),
            token('rgba8sint'),
            token('rgba16uint'),
            token('rgba16sint'),
            token('rgba16float'),
            token('r32uint'),
            token('r32sint'),
            token('r32float'),
            token('rg32uint'),
            token('rg32sint'),
            token('rg32float'),
            token('rgba32uint'),
            token('rgba32sint'),
            token('rgba32float')
        ),
        array: $ => token('array'),
        atomic: $ => token('atomic'),
        bool: $ => token('bool'),
        float32: $ => token('f32'),
        int32: $ => token('i32'),
        mat2x2: $ => token('mat2x2'),
        mat2x3: $ => token('mat2x3'),
        mat2x4: $ => token('mat2x4'),
        mat3x2: $ => token('mat3x2'),
        mat3x3: $ => token('mat3x3'),
        mat3x4: $ => token('mat3x4'),
        mat4x2: $ => token('mat4x2'),
        mat4x3: $ => token('mat4x3'),
        mat4x4: $ => token('mat4x4'),
        override: $ => token('override'),
        pointer: $ => token('ptr'),
        sampler: $ => token('sampler'),
        sampler_comparison: $ => token('sampler_comparison'),
        struct: $ => token('struct'),
        texture_1d: $ => token('texture_1d'),
        texture_2d: $ => token('texture_2d'),
        texture_2d_array: $ => token('texture_2d_array'),
        texture_3d: $ => token('texture_3d'),
        texture_cube: $ => token('texture_cube'),
        texture_cube_array: $ => token('texture_cube_array'),
        texture_multisampled_2d: $ => token('texture_multisampled_2d'),
        texture_storage_1d: $ => token('texture_storage_1d'),
        texture_storage_2d: $ => token('texture_storage_2d'),
        texture_storage_2d_array: $ => token('texture_storage_2d_array'),
        texture_storage_3d: $ => token('texture_storage_3d'),
        texture_depth_2d: $ => token('texture_depth_2d'),
        texture_depth_2d_array: $ => token('texture_depth_2d_array'),
        texture_depth_cube: $ => token('texture_depth_cube'),
        texture_depth_cube_array: $ => token('texture_depth_cube_array'),
        texture_depth_multisampled_2d: $ => token('texture_depth_multisampled_2d'),
        uint32: $ => token('u32'),
        vec2: $ => token('vec2'),
        vec3: $ => token('vec3'),
        vec4: $ => token('vec4'),
        bitcast: $ => token('bitcast'),
        break: $ => token('break'),
        case: $ => token('case'),
        continue: $ => token('continue'),
        continuing: $ => token('continuing'),
        default: $ => token('default'),
        discard: $ => token('discard'),
        else: $ => token('else'),
        enable: $ => token('enable'),
        fallthrough: $ => token('fallthrough'),
        false: $ => token('false'),
        fn: $ => token('fn'),
        for: $ => token('for'),
        function: $ => token('function'),
        if: $ => token('if'),
        let: $ => token('let'),
        loop: $ => token('loop'),
        private: $ => token('private'),
        return: $ => token('return'),
        storage: $ => token('storage'),
        switch: $ => token('switch'),
        true: $ => token('true'),
        type: $ => token('type'),
        uniform: $ => token('uniform'),
        var: $ => token('var'),
        workgroup: $ => token('workgroup'),
        and: $ => token('&'),
        and_and: $ => token('&&'),
        arrow: $ => token('->'),
        attr: $ => token('@'),
        forward_slash: $ => token('/'),
        bang: $ => token('!'),
        bracket_left: $ => token('['),
        bracket_right: $ => token(']'),
        brace_left: $ => token('{'),
        brace_right: $ => token('}'),
        colon: $ => token(':'),
        comma: $ => token(','),
        equal: $ => token('='),
        equal_equal: $ => token('=='),
        not_equal: $ => token('!='),
        greater_than: $ => token('>'),
        greater_than_equal: $ => token('>='),
        shift_right: $ => token('>>'),
        less_than: $ => token('<'),
        less_than_equal: $ => token('<='),
        shift_left: $ => token('<<'),
        modulo: $ => token('%'),
        minus: $ => token('-'),
        minus_minus: $ => token('--'),
        period: $ => token('.'),
        plus: $ => token('+'),
        plus_plus: $ => token('++'),
        or: $ => token('|'),
        or_or: $ => token('||'),
        paren_left: $ => token('('),
        paren_right: $ => token(')'),
        semicolon: $ => token(';'),
        star: $ => token('*'),
        tilde: $ => token('~'),
        underscore: $ => token('_'),
        xor: $ => token('^'),
        plus_equal: $ => token('+='),
        minus_equal: $ => token('-='),
        times_equal: $ => token('*='),
        division_equal: $ => token('/='),
        modulo_equal: $ => token('%='),
        and_equal: $ => token('&='),
        or_equal: $ => token('|='),
        xor_equal: $ => token('^='),
        shift_right_equal: $ => token('>>='),
        shift_left_equal: $ => token('<<='),
        _reserved: $ => choice(
            token('asm'),
            token('bf16'),
            token('const'),
            token('do'),
            token('enum'),
            token('f16'),
            token('f64'),
            token('handle'),
            token('i8'),
            token('i16'),
            token('i64'),
            token('mat'),
            token('premerge'),
            token('regardless'),
            token('typedef'),
            token('u8'),
            token('u16'),
            token('u64'),
            token('unless'),
            token('using'),
            token('vec'),
            token('void'),
            token('while')
        ),
        ident: $ => token(/([a-zA-Z_][0-9a-zA-Z][0-9a-zA-Z_]*)|([a-zA-Z][0-9a-zA-Z_]*)/),
        _comment: $ => seq(token('//'), token(/.*/)),
        _space: $ => token(/\s/)
    },
});
